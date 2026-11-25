# MatchMyCV

Give it a resume and a job description. A LangGraph agent parses both, judges every job
requirement against the resume with quoted evidence, scores the fit, and writes tailored
rewrites. An **honesty guard** checks every suggestion and sends the plan back for revision if
it claims skills the resume does not show.

**Stack:** LangGraph (workflow) · LangChain + Groq (LLM) · Pydantic (structured, validated
output) · FastAPI (API) · React + TypeScript + Vite + Tailwind (web UI) · pypdf / python-docx (uploads)

## Workflow

```
                 ┌─ parse_resume ─┐            (small model, run in parallel)
RESUME + JD ─────┤                ├─ match ─ score ─ optimize ─ guard ─┬─ finalize ─ report
                 └─ parse_job ────┘   (LLM)   (code)   (LLM)    (code) │
                                                          ▲            │ issues found and
                                                          └────────────┘ revisions left
```

| Node | Kind | Output (Pydantic) |
|---|---|---|
| `parse_resume` | LLM, small | `ResumeProfile`: roles, verbatim bullets, skills, education |
| `parse_job` | LLM, small | `JobRequirements`: each requirement with must-have / nice-to-have and ATS keywords |
| `match` | LLM, large | `MatchAnalysis`: met / partial / missing per requirement, with a resume quote as evidence. Then aligned in code so there is exactly one verdict per requirement |
| `score` | code | `MatchScore`: 60% must-haves, 15% nice-to-haves, 25% ATS keyword coverage (share of requirements with at least one of their JD terms in the resume, since "AWS, GCP or Azure" are alternatives). Reproducible, no LLM |
| `optimize` | LLM, large | `OptimizationPlan`: tailored summary, bullet rewrites, skills to lead with, keywords you can honestly add, gap advice, ATS tips |
| `guard` | code | `GuardIssue` list: rewrites whose "original" is not in the resume, rewrites or keywords that claim a *missing* requirement |
| `finalize` | code | `OptimizationReport`. If issues remain after the revision budget, the offending items are removed and listed. Also builds `TailoredCV`: the parsed resume with the approved rewrites, tailored summary and skill order applied (code, no LLM) |

Why some steps are code, not LLM: a score you can't reproduce isn't useful for comparing
resume versions, and a guard the model can argue with isn't a guard.

## The new CV

After a run, the **New CV** tab shows the tailored resume as a page. From there:

- **Change it with a prompt**: type an instruction ("shorten the summary", "add my AWS
  certification from 2024"). The large model returns the complete updated CV; facts may come
  only from the original resume or from your instruction. Skills that appear in neither are
  flagged so you can undo them.
- **History / Undo**: every edit is a saved version (`data/cvs/<id>.json`).
- **View online**: `/cv/<id>` is a standalone, printable page of the latest version.
- **Download PDF**: `/cv/<id>/pdf`, an A4 PDF rendered with ReportLab.
- **Download DOCX**: `/cv/<id>/docx`, an editable Word file (python-docx) with the same layout.

## Setup

```powershell
uv sync
copy .env.example .env   # then add GROQ_API_KEY
```

## Run

Build the web UI once (Node 20+); FastAPI serves it from `app/web/`:

```powershell
cd frontend; npm install; npm run build; cd ..
```

Without a build, `/` falls back to the legacy plain-HTML page in `app/templates/`.

For UI work, run the API and the Vite dev server (hot reload on http://localhost:5173, API
proxied to port 8765):

```powershell
uv run uvicorn app.main:app --port 8765 --reload
```

```powershell
cd frontend; npm run dev
```

Web app (upload PDF/DOCX/TXT or paste, watch the agent's steps stream in, download a Markdown report):

```powershell
uv run uvicorn app.main:app --reload
```

Open http://localhost:8000 and click **Load sample** to try it.

CLI:

```powershell
uv run python -m app.cli app/static/samples/resume.txt app/static/samples/job.txt --out report.md --json report.json -v
```

API: `POST /api/optimize` (multipart: `job_text`, and `resume_file` or `resume_text`) returns
NDJSON: one `{"event":"step"}` line per finished node, then `{"event":"result","report":…,"markdown":…,"cv_id":…}`.

CV endpoints: `GET /api/cv/{id}`, `POST /api/cv/{id}/edit` (JSON `{"instruction": "..."}`),
`POST /api/cv/{id}/undo`, `GET /cv/{id}` (HTML page), `GET /cv/{id}/pdf`, `GET /cv/{id}/docx`.

## Tests

```powershell
uv run pytest            # offline: a scripted fake LLM drives the real graph
$env:RUN_LIVE="1"; uv run pytest -m live -s   # one real run against Groq
```

## Project layout

```
app/
  schemas.py        Pydantic models for every step
  llm.py            Groq chat model + with_structured_output helper
  graph/
    builder.py      StateGraph: parallel fan-out, join, conditional revision loop
    nodes.py        node functions
    analysis.py     alignment, scoring, honesty guard (pure functions)
    prompts.py
  documents.py      PDF / DOCX / TXT text extraction
  report.py         Markdown report
  cv.py             tailored CV: build from plan, prompt edits, versioned store, PDF
  cli.py, main.py   CLI and FastAPI app
  templates/, static/   legacy web page (+ samples/)
  web/              built React UI (generated by frontend/, not committed)
frontend/           React + TypeScript UI (Vite, Tailwind)
  src/App.tsx       input -> streaming progress -> results flow
  src/components/   InputPanel, AgentProgress, Results (score, requirements, rewrites, gaps)
  src/types.ts      TS mirror of app/schemas.py
tests/
```

## Ideas to extend

- Export the tailored CV as DOCX too
- Cover letter node reusing `MatchAnalysis`
- LangSmith tracing + an eval set of resume/JD pairs with expected verdicts
- Human-in-the-loop: interrupt after `optimize` so the user accepts/rejects each rewrite
