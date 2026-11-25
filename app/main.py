"""FastAPI app: the web page plus a streaming /api/optimize endpoint.

/api/optimize answers with NDJSON: one {"event": "step", ...} line as each graph node finishes,
then a final {"event": "result", ...} or {"event": "error", ...} line. Input problems are
rejected with a normal 4xx before streaming starts.

The result carries a `cv_id`: the tailored CV is stored so it can be edited by prompt
(/api/cv/{id}/edit, /undo), viewed online (/cv/{id}) and downloaded as PDF (/cv/{id}/pdf).
"""

import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from app.config import get_settings
from app.cv import CVNotFound, CVStore, edit_cv, pdf_filename, render_pdf, unsupported_skills
from app.documents import DocumentError, extract_text
from app.graph.builder import get_graph
from app.report import to_markdown

BASE_DIR = Path(__file__).resolve().parent
log = logging.getLogger("app")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="MatchMyCV")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# React UI built by `npm run build` in frontend/. Without a build, "/" serves the legacy page.
WEB_DIR = BASE_DIR / "web"
app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets", check_dir=False), name="assets")

STEP_LABELS = {
    "parse_resume": "Parsed resume",
    "parse_job": "Parsed job description",
    "match": "Matched requirements",
    "score": "Scored fit",
    "optimize": "Drafted optimizations",
    "guard": "Checked for fabrication",
    "finalize": "Report ready",
}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    if (WEB_DIR / "index.html").is_file():
        return FileResponse(WEB_DIR / "index.html")
    return templates.TemplateResponse(request, "index.html", {})


@app.get("/health")
async def health():
    missing = get_settings().missing_keys()
    return {"status": "ok" if not missing else "missing_config", "missing": missing}


@app.post("/api/optimize")
async def optimize(
    job_text: Annotated[str, Form()],
    resume_text: Annotated[str, Form()] = "",
    resume_file: Annotated[UploadFile | None, File()] = None,
):
    settings = get_settings()
    if settings.missing_keys():
        raise HTTPException(503, "GROQ_API_KEY is not set on the server.")

    if resume_file is not None and resume_file.filename:
        data = await resume_file.read(settings.max_upload_bytes + 1)
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(413, "Resume file is larger than 5 MB.")
        try:
            resume_text = extract_text(resume_file.filename, data)
        except DocumentError as exc:
            raise HTTPException(400, str(exc)) from exc

    resume_text, job_text = resume_text.strip(), job_text.strip()
    if not resume_text:
        raise HTTPException(400, "Upload a resume file or paste its text.")
    if len(job_text) < 50:
        raise HTTPException(400, "Paste the full job description (at least 50 characters).")
    for label, text in (("Resume", resume_text), ("Job description", job_text)):
        if len(text) > settings.max_input_chars:
            raise HTTPException(
                413, f"{label} is longer than {settings.max_input_chars} characters."
            )

    async def events():
        state: dict = {}
        try:
            async for update in get_graph().astream(
                {"resume_text": resume_text, "job_text": job_text, "revisions": 0},
                stream_mode="updates",
            ):
                for node, delta in update.items():
                    state.update(delta or {})
                    label = STEP_LABELS.get(node, node)
                    if node == "guard" and delta.get("guard_issues"):
                        label = f"Guard flagged {len(delta['guard_issues'])} issue(s)"
                    yield _line({"event": "step", "node": node, "label": label})
            report = state["report"]
            cv_id = store().create(report.cv, resume_text) if report.cv else None
            yield _line(
                {
                    "event": "result",
                    "report": report.model_dump(mode="json"),
                    "markdown": to_markdown(report),
                    "cv_id": cv_id,
                }
            )
        except Exception as exc:
            log.exception("optimization failed")
            yield _line({"event": "error", "message": f"{type(exc).__name__}: {exc}"[:500]})

    return StreamingResponse(events(), media_type="application/x-ndjson")


def _line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------- the new CV


def store() -> CVStore:
    return CVStore(get_settings().cv_dir)


def _load(cv_id: str) -> dict:
    try:
        return store().get(cv_id)
    except CVNotFound:
        raise HTTPException(404, "CV not found.") from None


def _cv_payload(entry: dict, **extra) -> dict:
    return {
        "id": entry["id"],
        "cv": entry["cv"].model_dump(mode="json"),
        "history": entry["history"],
        **extra,
    }


class EditRequest(BaseModel):
    instruction: str = Field(min_length=1)


@app.get("/api/cv/{cv_id}")
async def get_cv(cv_id: str):
    return _cv_payload(_load(cv_id))


@app.post("/api/cv/{cv_id}/edit")
async def edit(cv_id: str, body: EditRequest):
    settings = get_settings()
    if settings.missing_keys():
        raise HTTPException(503, "GROQ_API_KEY is not set on the server.")
    instruction = body.instruction.strip()
    if not instruction:
        raise HTTPException(400, "Describe the change you want.")
    if len(instruction) > settings.max_instruction_chars:
        raise HTTPException(
            413, f"Keep instructions under {settings.max_instruction_chars} characters."
        )

    entry = _load(cv_id)
    try:
        result = await edit_cv(entry["cv"], instruction, entry["resume_text"])
    except Exception as exc:
        log.exception("cv edit failed")
        raise HTTPException(
            502, f"The model could not apply that change: {type(exc).__name__}"
        ) from exc

    warnings = unsupported_skills(result.cv, entry["cv"], entry["resume_text"], instruction)
    store().add_version(cv_id, result.cv, instruction[:200])
    return _cv_payload(_load(cv_id), change_summary=result.change_summary, warnings=warnings)


@app.post("/api/cv/{cv_id}/undo")
async def undo(cv_id: str):
    _load(cv_id)
    if not store().undo(cv_id):
        raise HTTPException(409, "Nothing to undo.")
    return _cv_payload(_load(cv_id))


@app.get("/cv/{cv_id}", response_class=HTMLResponse)
async def view_cv(request: Request, cv_id: str):
    entry = _load(cv_id)
    return templates.TemplateResponse(
        request, "cv.html", {"cv": entry["cv"], "cv_id": cv_id, "versions": len(entry["history"])}
    )


@app.get("/cv/{cv_id}/pdf")
async def cv_pdf(cv_id: str, inline: bool = False):
    cv = _load(cv_id)["cv"]
    disposition = "inline" if inline else "attachment"
    return Response(
        render_pdf(cv),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{pdf_filename(cv)}"'},
    )
