import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.runnables import RunnableLambda

from app import llm, main
from app.config import Settings
from app.cv import CVNotFound, CVStore, build_cv, render_pdf, unsupported_skills
from app.schemas import CVEdit
from tests.conftest import EMBEDDINGS_BULLET, GOOD_PLAN, JOB_TEXT, RESUME, RESUME_TEXT


def test_build_cv_applies_plan():
    cv = build_cv(RESUME, GOOD_PLAN)
    assert cv.name == "Alex Rivera"
    assert cv.summary == GOOD_PLAN.tailored_summary
    assert cv.experience[0].bullets == [GOOD_PLAN.bullet_rewrites[0].rewritten]
    assert EMBEDDINGS_BULLET not in cv.experience[0].bullets
    # Highlighted skills lead, nothing is duplicated, honest keywords are appended.
    assert cv.skills[:2] == ["Python", "FastAPI"]
    assert len(cv.skills) == len({s.lower() for s in cv.skills})
    assert cv.skills[-1] == "embeddings"


def test_headline_drops_contact_details():
    resume = RESUME.model_copy(
        update={
            "headline": "Software Engineer | Bengaluru, India | alex.rivera@example.com",
            "contact": ["alex.rivera@example.com", "Bengaluru, India"],
        }
    )
    assert build_cv(resume, GOOD_PLAN).headline == "Software Engineer"


def test_render_pdf():
    pdf = render_pdf(build_cv(RESUME, GOOD_PLAN))
    assert pdf.startswith(b"%PDF") and len(pdf) > 1000


def test_unsupported_skills_flags_new_claims():
    old = build_cv(RESUME, GOOD_PLAN)
    new = old.model_copy(update={"skills": [*old.skills, "Kubernetes", "Terraform"]})
    assert unsupported_skills(new, old, RESUME_TEXT, "add Terraform, I used it at DataNest") == [
        "Kubernetes"
    ]


def test_store_versions_and_undo(tmp_path):
    store = CVStore(tmp_path)
    cv = build_cv(RESUME, GOOD_PLAN)
    cv_id = store.create(cv, RESUME_TEXT)
    store.add_version(cv_id, cv.model_copy(update={"summary": "Short."}), "shorter")
    assert store.get(cv_id)["cv"].summary == "Short."
    assert store.undo(cv_id) and not store.undo(cv_id)
    assert store.get(cv_id)["cv"].summary == cv.summary
    with pytest.raises(CVNotFound):
        store.get("../../etc/passwd")


@pytest.fixture
def client(monkeypatch, fake_llm, tmp_path):
    monkeypatch.setattr(
        main, "get_settings", lambda: Settings(groq_api_key="test-key", cv_dir=tmp_path)
    )
    return TestClient(main.app)


def _cv_id(client) -> str:
    r = client.post("/api/optimize", data={"resume_text": RESUME_TEXT, "job_text": JOB_TEXT})
    final = json.loads(r.text.strip().splitlines()[-1])
    assert final["report"]["cv"]["name"] == "Alex Rivera"
    return final["cv_id"]


def test_edit_view_download_undo(client, monkeypatch):
    cv_id = _cv_id(client)

    def fake_edit(schema, size="large"):
        assert schema is CVEdit

        def respond(messages):
            current = json.loads(messages[1].content.split("<current_cv>")[1].split("</current_cv>")[0])
            current["summary"] = "Python backend engineer."
            current["skills"].append("Kubernetes")
            return CVEdit.model_validate({"cv": current, "change_summary": "Shortened summary."})

        return RunnableLambda(respond)

    monkeypatch.setattr(llm, "structured", fake_edit)
    r = client.post(f"/api/cv/{cv_id}/edit", json={"instruction": "Make the summary one line"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cv"]["summary"] == "Python backend engineer."
    assert body["warnings"] == ["Kubernetes"]
    assert len(body["history"]) == 2

    page = client.get(f"/cv/{cv_id}")
    assert page.status_code == 200 and "Python backend engineer." in page.text

    pdf = client.get(f"/cv/{cv_id}/pdf")
    assert pdf.headers["content-type"] == "application/pdf"
    assert "Alex_Rivera_CV.pdf" in pdf.headers["content-disposition"]

    r = client.post(f"/api/cv/{cv_id}/undo")
    assert r.json()["cv"]["summary"] != "Python backend engineer."
    assert client.post(f"/api/cv/{cv_id}/undo").status_code == 409


def test_cv_errors(client):
    assert client.get("/cv/" + "0" * 32).status_code == 404
    assert client.get("/api/cv/not-an-id").status_code == 404
    cv_id = _cv_id(client)
    assert client.post(f"/api/cv/{cv_id}/edit", json={"instruction": "   "}).status_code == 400
