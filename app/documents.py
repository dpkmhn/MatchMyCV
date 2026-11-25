"""Turn an uploaded resume (PDF, DOCX, TXT, MD) into plain text."""

import io
from pathlib import Path


class DocumentError(ValueError):
    pass


SUPPORTED = (".pdf", ".docx", ".txt", ".md")


def extract_text(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        text = _pdf(data)
    elif suffix == ".docx":
        text = _docx(data)
    elif suffix in (".txt", ".md"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise DocumentError(
            f"Unsupported file type {suffix or '(none)'}. Use {', '.join(SUPPORTED)}."
        )
    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not text:
        raise DocumentError(
            "No text found in the file. If it is a scanned PDF, export it as text-based PDF or DOCX."
        )
    return text


def read_path(path: str | Path) -> str:
    path = Path(path)
    return extract_text(path.name, path.read_bytes())


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:  # pypdf raises many types for malformed files
        raise DocumentError(f"Could not read PDF: {exc}") from exc


def _docx(data: bytes) -> str:
    from docx import Document

    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:
        raise DocumentError(f"Could not read DOCX: {exc}") from exc
    lines = [p.text for p in doc.paragraphs]
    for table in doc.tables:  # many resume templates lay out sections in tables
        for row in table.rows:
            lines.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(lines)
