from app.graph import analysis as an
from tests.conftest import ANALYSIS, BAD_PLAN, GOOD_PLAN, JOB, RESUME_TEXT


def test_contains_term_handles_symbols():
    assert an.contains_term("Skilled in C++ and CI/CD", "c++")
    assert an.contains_term("Skilled in C++ and CI/CD", "CI/CD")
    assert not an.contains_term("JavaScript developer", "Java")
    assert an.contains_term("Node.js, React", "node.js")


def test_align_matches_reorders_and_fills_gaps():
    aligned = an.align_matches(JOB, ANALYSIS)
    assert [m.requirement for m in aligned.matches] == [r.text for r in JOB.requirements]
    assert [m.status for m in aligned.matches] == ["met", "partial", "partial", "missing"]

    partial = ANALYSIS.model_copy(update={"matches": ANALYSIS.matches[:2]})
    filled = an.align_matches(JOB, partial)
    assert len(filled.matches) == 4
    assert filled.matches[2].status == "missing" and "Not assessed" in filled.matches[2].note


def test_score_is_deterministic():
    aligned = an.align_matches(JOB, ANALYSIS)
    s = an.compute_score(JOB, aligned, RESUME_TEXT)
    # must: (1 + .5 + .5) / 3 = 67%; nice: 0%; keyword groups: 3 of 4 have a term present
    # (LangGraph/pgvector are alternatives to LangChain/FAISS, so they don't count as missing)
    assert (s.must_have, s.nice_to_have, s.keyword_coverage) == (67, 0, 75)
    assert s.missing_keywords == ["Kubernetes"]
    assert s.overall == round(67 * 0.6 + 0 * 0.15 + 75 * 0.25)


def test_fix_keywords_added_drops_terms_already_in_original():
    rw = GOOD_PLAN.bullet_rewrites[0].model_copy(update={"keywords_added": ["LLM", "OpenAI"]})
    fixed = an.fix_keywords_added(GOOD_PLAN.model_copy(update={"bullet_rewrites": [rw]}))
    assert fixed.bullet_rewrites[0].keywords_added == ["LLM"]


def test_guard_flags_fabricated_skill_and_keyword():
    aligned = an.align_matches(JOB, ANALYSIS)
    kinds = sorted(i.kind for i in an.check_plan(BAD_PLAN, JOB, aligned, RESUME_TEXT))
    assert kinds == ["missing_skill_claimed", "unsupported_keyword"]
    assert an.check_plan(GOOD_PLAN, JOB, aligned, RESUME_TEXT) == []


def test_guard_flags_invented_original():
    aligned = an.align_matches(JOB, ANALYSIS)
    rw = GOOD_PLAN.bullet_rewrites[0].model_copy(update={"original": "Led a team of 30 engineers."})
    plan = GOOD_PLAN.model_copy(update={"bullet_rewrites": [rw]})
    assert [i.kind for i in an.check_plan(plan, JOB, aligned, RESUME_TEXT)] == ["unknown_original"]


def test_sanitize_drops_rejected_items():
    aligned = an.align_matches(JOB, ANALYSIS)
    clean = an.sanitize_plan(BAD_PLAN, JOB, aligned, RESUME_TEXT)
    assert clean.bullet_rewrites == []
    assert clean.keywords_to_add == ["embeddings"]
