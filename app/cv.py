"""The new CV: built from the optimization plan, edited by prompt, stored with history, and
rendered as PDF.

- `build_cv` is deterministic: the parsed resume with the guard-approved rewrites, summary and
  skill order applied. No LLM, so nothing new can slip in at this step.
- `edit_cv` applies one free-text instruction with the large model, then flags any skill that
  appears in neither the original resume, the previous CV nor the instruction itself.
- `CVStore` keeps every version on disk so edits can be undone and the CV has a stable URL.
"""

import json
import re
import uuid
from datetime import UTC, datetime
from difflib import SequenceMatcher
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from langchain_core.messages import HumanMessage, SystemMessage

from app import llm
from app.graph.analysis import contains_term, norm
from app.schemas import CVEdit, CVRole, OptimizationPlan, ResumeProfile, TailoredCV

# ---------------------------------------------------------------- build


def _dedupe(items: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for item in items:
        if item and item.strip():
            seen.setdefault(norm(item), item.strip())
    return list(seen.values())


def _rewrite_for(bullet: str, plan: OptimizationPlan) -> str:
    best, best_score = bullet, 0.0
    for rw in plan.bullet_rewrites:
        score = SequenceMatcher(None, norm(bullet), norm(rw.original)).ratio()
        if score > best_score:
            best, best_score = rw.rewritten, score
    return best if best_score >= 0.9 else bullet


def _clean_headline(headline: str | None, contact: list[str]) -> str | None:
    """Drop contact details the parser left in the headline ("Engineer | Pune | a@b.com")."""
    if not headline:
        return headline
    known = {norm(c) for c in contact}
    parts = [x.strip() for x in re.split(r"\s*[|•·]\s*", headline) if x.strip()]
    kept = [x for x in parts if norm(x) not in known and "@" not in x]
    return " | ".join(kept) or None


def build_cv(resume: ResumeProfile, plan: OptimizationPlan) -> TailoredCV:
    return TailoredCV(
        name=(resume.name or "Your Name").strip(),
        headline=_clean_headline(resume.headline, resume.contact),
        contact=resume.contact,
        summary=plan.tailored_summary or resume.summary or "",
        skills=_dedupe([*plan.skills_to_highlight, *resume.skills, *plan.keywords_to_add]),
        experience=[
            CVRole(
                title=r.title,
                company=r.company,
                dates=r.dates,
                bullets=[_rewrite_for(b, plan) for b in r.bullets],
            )
            for r in resume.roles
        ],
        projects=resume.projects,
        education=resume.education,
        certifications=resume.certifications,
    )


# ---------------------------------------------------------------- edit by prompt

EDIT_PROMPT = """You edit a candidate's CV according to their instruction.
Return the complete CV with the instruction applied and everything else unchanged.
Rules:
- The instruction is from the candidate, so facts it states (a new link, a certification, a
  role) may be added.
- Otherwise never invent employers, dates, numbers, tools, skills or achievements: use only
  what the current CV or the original resume shows.
- If the instruction can't be applied honestly, make the closest honest change (or none) and
  say why in change_summary.
- Keep bullets concise, start them with action verbs, and keep the most recent role first."""


def unsupported_skills(new: TailoredCV, old: TailoredCV, resume_text: str, instruction: str):
    """Skills the edit introduced that nothing the candidate wrote supports."""
    known = " \n ".join([resume_text, instruction, *old.skills])
    return [s for s in new.skills if not contains_term(known, s)]


async def edit_cv(cv: TailoredCV, instruction: str, resume_text: str) -> CVEdit:
    return await llm.structured(CVEdit, "large").ainvoke(
        [
            SystemMessage(EDIT_PROMPT),
            HumanMessage(
                f"<original_resume>\n{resume_text}\n</original_resume>\n\n"
                f"<current_cv>\n{cv.model_dump_json(indent=1)}\n</current_cv>\n\n"
                f"<instruction>\n{instruction}\n</instruction>"
            ),
        ]
    )


# ---------------------------------------------------------------- storage

_ID = re.compile(r"^[0-9a-f]{32}$")


class CVNotFound(LookupError):
    pass


class CVStore:
    """One JSON file per CV: the source resume text plus every version, newest last."""

    def __init__(self, root: Path):
        self.root = root

    def _path(self, cv_id: str) -> Path:
        if not _ID.match(cv_id):
            raise CVNotFound(cv_id)
        return self.root / f"{cv_id}.json"

    def _read(self, cv_id: str) -> dict:
        path = self._path(cv_id)
        if not path.is_file():
            raise CVNotFound(cv_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def _write(self, cv_id: str, data: dict) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        tmp = self._path(cv_id).with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self._path(cv_id))

    def create(self, cv: TailoredCV, resume_text: str, note: str = "Tailored CV created") -> str:
        cv_id = uuid.uuid4().hex
        self._write(cv_id, {"resume_text": resume_text, "versions": [_version(cv, note)]})
        return cv_id

    def get(self, cv_id: str) -> dict:
        """{"id", "cv": TailoredCV, "resume_text", "history": [{"note", "at"}...]}"""
        data = self._read(cv_id)
        return {
            "id": cv_id,
            "cv": TailoredCV.model_validate(data["versions"][-1]["cv"]),
            "resume_text": data["resume_text"],
            "history": [{"note": v["note"], "at": v["at"]} for v in data["versions"]],
        }

    def add_version(self, cv_id: str, cv: TailoredCV, note: str) -> None:
        data = self._read(cv_id)
        data["versions"].append(_version(cv, note))
        self._write(cv_id, data)

    def undo(self, cv_id: str) -> bool:
        data = self._read(cv_id)
        if len(data["versions"]) < 2:
            return False
        data["versions"].pop()
        self._write(cv_id, data)
        return True


def _version(cv: TailoredCV, note: str) -> dict:
    return {"cv": cv.model_dump(mode="json"), "note": note, "at": datetime.now(UTC).isoformat()}


# ---------------------------------------------------------------- PDF

_FONT_CANDIDATES = [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ),
    ("/Library/Fonts/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf"),
]


@lru_cache
def _fonts() -> tuple[str, str]:
    """A Unicode TrueType font if the system has one, else the built-in Helvetica."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    for regular, bold in _FONT_CANDIDATES:
        if Path(regular).is_file() and Path(bold).is_file():
            pdfmetrics.registerFont(TTFont("CV", regular))
            pdfmetrics.registerFont(TTFont("CV-Bold", bold))
            return "CV", "CV-Bold"
    return "Helvetica", "Helvetica-Bold"


# Characters models like to emit that common fonts lack (they print as empty boxes).
_PDF_CHARS = str.maketrans(
    {
        0x2010: "-",  # hyphen
        0x2011: "-",  # non-breaking hyphen
        0x2012: chr(0x2013),  # figure dash -> en dash
        0x2212: "-",  # minus
        0x2009: " ",  # thin space
        0x202F: " ",  # narrow no-break space
        0x200B: "",  # zero-width space
    }
)


def _pdf_text(text: str) -> str:
    return escape(text.translate(_PDF_CHARS))


def render_pdf(cv: TailoredCV) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        HRFlowable,
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    regular, bold = _fonts()
    ink, muted, accent = (
        colors.HexColor("#18181b"),
        colors.HexColor("#52525b"),
        colors.HexColor("#4f46e5"),
    )
    base = ParagraphStyle("base", fontName=regular, fontSize=9.8, leading=13.4, textColor=ink)
    s = {
        "name": ParagraphStyle("name", base, fontName=bold, fontSize=22, leading=26),
        "headline": ParagraphStyle("headline", base, fontSize=11.5, leading=15, textColor=accent),
        "contact": ParagraphStyle("contact", base, fontSize=9, textColor=muted),
        "h": ParagraphStyle(
            "h",
            base,
            fontName=bold,
            fontSize=10.5,
            leading=14,
            textColor=accent,
            spaceBefore=9,
            spaceAfter=2,
        ),
        "role": ParagraphStyle("role", base, fontName=bold, fontSize=10.3),
        "dates": ParagraphStyle("dates", base, fontSize=9, textColor=muted, alignment=TA_RIGHT),
        "bullet": ParagraphStyle("bullet", base, leftIndent=11, bulletIndent=2, spaceBefore=1.5),
        "body": base,
    }

    def p(text: str, style: str, **kw) -> Paragraph:
        return Paragraph(_pdf_text(text), s[style], **kw)

    def section(title: str) -> list:
        return [
            p(title.upper(), "h"),
            HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#d4d4d8"), spaceAfter=4),
        ]

    story: list = [p(cv.name, "name")]
    if cv.headline:
        story.append(p(cv.headline, "headline"))
    if cv.contact:
        story.append(Paragraph("  ·  ".join(_pdf_text(c) for c in cv.contact), s["contact"]))
    story.append(Spacer(1, 4))

    if cv.summary:
        story += [*section("Summary"), p(cv.summary, "body")]
    if cv.skills:
        story += [*section("Skills"), p(", ".join(cv.skills), "body")]
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"{cv.name} - CV",
        author=cv.name,
    )
    if cv.experience:
        story += section("Experience")
        width = doc.width - 12  # the frame keeps 6pt padding on each side
        for i, role in enumerate(cv.experience):
            head = Table(
                [
                    [
                        Paragraph(
                            f"{_pdf_text(role.title)}  <font color='#52525b'>·</font>  "
                            f"{_pdf_text(role.company)}",
                            s["role"],
                        ),
                        p(role.dates or "", "dates"),
                    ]
                ],
                colWidths=[width * 0.72, width * 0.28],
                hAlign="LEFT",
            )
            head.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 6 if i else 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ]
                )
            )
            bullets = [p(b, "bullet", bulletText="•") for b in role.bullets]
            # Keep the role header with its first bullet so it never ends a page alone.
            story.append(KeepTogether([head, *bullets[:1]]))
            story += bullets[1:]
    for title, items in (
        ("Projects", cv.projects),
        ("Education", cv.education),
        ("Certifications", cv.certifications),
    ):
        if items:
            story += [*section(title), *[p(x, "bullet", bulletText="•") for x in items]]

    doc.build(story)
    return buf.getvalue()


def pdf_filename(cv: TailoredCV) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", cv.name).strip("_") or "CV"
    return f"{slug}_CV.pdf"
