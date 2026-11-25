import io
import json

import pytest
from docx import Document
from fastapi.testclient import TestClient

from app import main
from app.config import Settings
from app.documents import DocumentError, extract_text
from tests.conftest import JOB_TEXT, RESUME_TEXT


@pytest.fixture
def client(monkeypatch, fake_llm):
    monkeypatch.setattr(main, "get_settings", lambda: Settings(groq_api_key="test-key"))
    return TestClient(main.app)


def events(response):
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def test_index_and_health(client):
    assert "MatchMyCV" in client.get("/").text
    assert client.get("/health").status_code == 200


def test_optimize_streams_steps_then_result(client):
    r = client.post("/api/optimize", data={"resume_text": RESUME_TEXT, "job_text": JOB_TEXT})
    assert r.status_code == 200
    evs = events(r)
    nodes = [e["node"] for e in evs if e["event"] == "step"]
    assert set(nodes[:2]) == {"parse_resume", "parse_job"}
    assert nodes[2:] == ["match", "score", "optimize", "guard", "optimize", "guard", "finalize"]
    final = evs[-1]
    assert final["event"] == "result"
    assert final["report"]["score"]["overall"] > 0
    assert final["markdown"].startswith("# Resume optimization")


def test_optimize_accepts_docx_upload(client):
    doc = Document()
    for line in RESUME_TEXT.splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    files = {
        "resume_file": (
            "resume.docx",
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    r = client.post("/api/optimize", data={"job_text": JOB_TEXT}, files=files)
    assert events(r)[-1]["event"] == "result"


def test_rejects_bad_input(client):
    assert client.post("/api/optimize", data={"job_text": JOB_TEXT}).status_code == 400
    r = client.post("/api/optimize", data={"resume_text": RESUME_TEXT, "job_text": "too short"})
    assert r.status_code == 400
    files = {"resume_file": ("resume.exe", b"MZ", "application/octet-stream")}
    assert client.post("/api/optimize", data={"job_text": JOB_TEXT}, files=files).status_code == 400


def test_missing_key_is_503(monkeypatch):
    monkeypatch.setattr(main, "get_settings", lambda: Settings(groq_api_key=None))
    r = TestClient(main.app).post("/api/optimize", data={"resume_text": "x", "job_text": JOB_TEXT})
    assert r.status_code == 503


def test_extract_text_errors():
    with pytest.raises(DocumentError):
        extract_text("resume.txt", b"   \n  ")
    assert extract_text("r.md", b"# Hi\nthere  \n") == "# Hi\nthere"
