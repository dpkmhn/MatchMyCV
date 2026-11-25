import asyncio
import os

import pytest

from app.config import Settings
from app.graph import builder
from app.report import to_markdown
from tests.conftest import JOB_TEXT, RESUME_TEXT


def run(resume=RESUME_TEXT, job=JOB_TEXT):
    return asyncio.run(builder.build_graph().ainvoke(
        {"resume_text": resume, "job_text": job, "revisions": 0}))["report"]


def test_guard_sends_plan_back_for_revision(fake_llm):
    report = run()
    assert report.revisions == 1
    assert report.guard_issues == []
    assert "Kubernetes" not in report.plan.bullet_rewrites[0].rewritten
    # The revision prompt showed the model what the guard rejected.
    second_call = fake_llm.calls["OptimizationPlan"][1]
    assert "Kubernetes" in second_call[-1].content
    # Parse nodes ran once each, in parallel branches.
    assert len(fake_llm.calls["ResumeProfile"]) == len(fake_llm.calls["JobRequirements"]) == 1


def test_no_revision_budget_sanitizes(fake_llm, monkeypatch):
    monkeypatch.setattr(builder, "get_settings", lambda: Settings(max_revisions=0))
    report = run()
    assert report.revisions == 0
    assert {i.kind for i in report.guard_issues} == {"missing_skill_claimed", "unsupported_keyword"}
    assert report.plan.bullet_rewrites == []
    assert "Kubernetes" not in report.plan.keywords_to_add


def test_markdown_report(fake_llm):
    md = to_markdown(run())
    assert md.startswith("# Resume optimization: AI Engineer")
    assert "| ❌ | Kubernetes |" in md
    assert "## Bullet rewrites" in md


@pytest.mark.live
@pytest.mark.skipif(os.getenv("RUN_LIVE") != "1", reason="set RUN_LIVE=1 to call Groq")
def test_live_sample():
    report = asyncio.run(builder.run(RESUME_TEXT, JOB_TEXT))
    assert 0 <= report.score.overall <= 100
    assert len(report.analysis.matches) == len(report.job.requirements)
    assert report.plan.tailored_summary
    print("\n" + to_markdown(report))
