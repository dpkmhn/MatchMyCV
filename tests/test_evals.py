"""The eval harness itself: scoring helpers, and a full offline run with the scripted model."""

import asyncio

from app import llm
from app.schemas import BulletRewrite, JobRequirements, MatchScore, OptimizationReport, Requirement
from evals.metrics import fabrications, find_requirement, quote_in_resume
from evals.run_eval import load_cases, run_case
from tests.conftest import ANALYSIS, GOOD_PLAN, JOB
from tests.conftest import RESUME as RESUME_PROFILE

RESUME = "- Built REST APIs in FastAPI for 40 banks.\n- Set up GitHub Actions pipelines."


def test_quotes_with_ellipsis_must_match_every_fragment():
    assert quote_in_resume("Built REST APIs ... for 40 banks", RESUME)
    assert quote_in_resume('"Set up GitHub Actions pipelines."', RESUME)
    assert not quote_in_resume("Built REST APIs ... for 400 banks", RESUME)
    assert not quote_in_resume("...", RESUME)


def test_label_finds_first_requirement_by_text_or_keyword():
    job = JobRequirements(
        title="x",
        seniority="mid",
        requirements=[
            Requirement(
                text="Cloud platform",
                category="skill",
                importance="must_have",
                keywords=["AWS", "GCP"],
            ),
            Requirement(text="Kubernetes", category="skill", importance="nice_to_have"),
        ],
    )
    assert find_requirement(job, ["GCP"])[0] == 0
    assert find_requirement(job, ["kubernetes"])[0] == 1
    assert find_requirement(job, ["Terraform"]) == (None, None)


def test_every_case_loads_and_scores_offline(monkeypatch):
    monkeypatch.setattr(llm, "structured", llm.structured)  # run_case swaps it; restore after
    cases, ranking = load_cases()
    assert len(cases) == 11
    ids = {c["id"] for c in cases}
    assert all(a in ids and b in ids for a, b in ranking)
    for case in cases:
        res, _ = asyncio.run(run_case(case, fake=True))
        assert res.ok, res.error
        assert all(lr.found for lr in res.labels), case["id"]
        assert all(lr.correct for lr in res.labels), case["id"]
        assert res.rewrites_grounded == res.rewrites_total


def test_guard_blind_spot_shows_up_as_fabrication(monkeypatch):
    """B3's trap words are in the resume (inside the injected note), so the guard's word
    search lets the scripted model's 'Tableau' claim through and the eval reports it."""
    monkeypatch.setattr(llm, "structured", llm.structured)
    case = next(c for c in load_cases()[0] if c["id"] == "B3")
    res, _ = asyncio.run(run_case(case, fake=True))
    assert res.revisions == 0
    assert {f["term"] for f in res.fabrications} == {"Tableau"}


def test_rewrite_keeping_a_term_from_its_original_is_not_fabrication():
    plan = GOOD_PLAN.model_copy(
        update={
            "bullet_rewrites": [
                BulletRewrite(
                    original="Used AWS Lambda", rewritten="Built on AWS Lambda", reason="x"
                )
            ],
            "skills_to_highlight": ["GCP"],
            "keywords_to_add": [],
            "tailored_summary": "Engineer.",
        }
    )
    score = MatchScore(
        overall=50,
        must_have=50,
        nice_to_have=50,
        keyword_coverage=50,
        matched_keywords=[],
        missing_keywords=[],
    )
    report = OptimizationReport(
        resume=RESUME_PROFILE, job=JOB, analysis=ANALYSIS, score=score, plan=plan
    )
    assert fabrications(report, ["AWS"]) == []
    assert [f["where"] for f in fabrications(report, ["GCP"])] == ["skills_to_highlight"]
