"""Deterministic (no-LLM) parts of the workflow: alignment, scoring and the honesty guard.

Keeping these in plain code makes the score reproducible and the guard impossible to talk
around, and lets them be unit-tested without an API key.
"""

import re
from difflib import SequenceMatcher

from app.schemas import (
    GuardIssue,
    JobRequirements,
    MatchAnalysis,
    MatchScore,
    OptimizationPlan,
    RequirementMatch,
)

_STATUS_CREDIT = {"met": 1.0, "partial": 0.5, "missing": 0.0}


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def contains_term(haystack: str, term: str) -> bool:
    """Case-insensitive whole-term search that also works for C++, .NET, CI/CD, Node.js."""
    term = norm(term)
    if not term:
        return False
    pattern = r"(?<![\w])" + re.escape(term) + r"(?![\w])"
    return re.search(pattern, norm(haystack)) is not None


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def align_matches(job: JobRequirements, analysis: MatchAnalysis) -> MatchAnalysis:
    """Return exactly one match per requirement, in requirement order.

    Models sometimes skip, merge or reorder items. Each requirement takes the most similar
    unused match; any requirement left without one is recorded as missing/not assessed.
    """
    pool = list(analysis.matches)
    aligned: list[RequirementMatch] = []
    for req in job.requirements:
        best_i, best = None, 0.0
        for i, m in enumerate(pool):
            score = _similar(req.text, m.requirement)
            if score > best:
                best_i, best = i, score
        if best_i is not None and best >= 0.6:
            m = pool.pop(best_i)
            aligned.append(m.model_copy(update={"requirement": req.text}))
        else:
            aligned.append(
                RequirementMatch(
                    requirement=req.text,
                    status="missing",
                    evidence=None,
                    note="Not assessed by the model; treated as missing.",
                )
            )
    return analysis.model_copy(update={"matches": aligned})


def job_keywords(job: JobRequirements) -> list[str]:
    seen: dict[str, str] = {}
    for req in job.requirements:
        for kw in req.keywords:
            if kw.strip():
                seen.setdefault(norm(kw), kw.strip())
    return list(seen.values())


def compute_score(job: JobRequirements, analysis: MatchAnalysis, resume_text: str) -> MatchScore:
    def pct(importance: str) -> int | None:
        credits = [
            _STATUS_CREDIT[m.status]
            for req, m in zip(job.requirements, analysis.matches, strict=True)
            if req.importance == importance
        ]
        return round(100 * sum(credits) / len(credits)) if credits else None

    must, nice = pct("must_have"), pct("nice_to_have")

    # A requirement's keywords are usually alternatives ("AWS, GCP or Azure"), so coverage is
    # the share of requirements where at least one of their terms appears in the resume.
    # Missing keywords are only reported for requirements with no term present at all.
    groups = [r.keywords for r in job.requirements if any(k.strip() for k in r.keywords)]
    covered = [g for g in groups if any(contains_term(resume_text, k) for k in g)]
    keywords = job_keywords(job)
    matched = [k for k in keywords if contains_term(resume_text, k)]
    uncovered = {norm(k) for g in groups if g not in covered for k in g}
    missing = [k for k in keywords if norm(k) in uncovered]
    kw_cov = round(100 * len(covered) / len(groups)) if groups else 100

    # Must-haves dominate: a recruiter screens on them first. Keyword coverage approximates
    # what an ATS sees. Weights are redistributed when a JD has no nice-to-haves.
    parts = [(must, 0.6), (nice, 0.15), (kw_cov, 0.25)]
    present = [(v, w) for v, w in parts if v is not None]
    overall = round(sum(v * w for v, w in present) / sum(w for _, w in present))

    return MatchScore(
        overall=overall,
        must_have=must if must is not None else 100,
        nice_to_have=nice if nice is not None else 100,
        keyword_coverage=kw_cov,
        matched_keywords=matched,
        missing_keywords=missing,
    )


def unsupported_terms(job: JobRequirements, analysis: MatchAnalysis, resume_text: str) -> set[str]:
    """Keywords of requirements judged *missing* that appear nowhere in the resume.

    Claiming any of these in the optimized resume would be fabrication.
    """
    terms: set[str] = set()
    for req, m in zip(job.requirements, analysis.matches, strict=True):
        if m.status == "missing":
            terms.update(k for k in req.keywords if not contains_term(resume_text, k))
    return terms


def _in_resume(line: str, resume_text: str) -> bool:
    if norm(line) in norm(resume_text):
        return True
    # Tolerate bullet glyphs / small whitespace differences.
    return any(_similar(line, row) >= 0.9 for row in resume_text.splitlines() if row.strip())


def check_plan(
    plan: OptimizationPlan, job: JobRequirements, analysis: MatchAnalysis, resume_text: str
) -> list[GuardIssue]:
    issues: list[GuardIssue] = []
    forbidden = unsupported_terms(job, analysis, resume_text)

    for rw in plan.bullet_rewrites:
        if not _in_resume(rw.original, resume_text):
            issues.append(
                GuardIssue(
                    kind="unknown_original",
                    detail=f'Rewrite source is not in the resume: "{rw.original[:120]}"',
                )
            )
        for term in sorted(forbidden):
            if contains_term(rw.rewritten, term) and not contains_term(rw.original, term):
                issues.append(
                    GuardIssue(
                        kind="missing_skill_claimed",
                        detail=f'Rewrite claims "{term}", which the resume never shows: '
                        f'"{rw.rewritten[:120]}"',
                    )
                )

    for term in [*plan.keywords_to_add, *plan.skills_to_highlight]:
        if any(norm(term) == norm(f) for f in forbidden):
            issues.append(
                GuardIssue(
                    kind="unsupported_keyword",
                    detail=f'"{term}" belongs to a missing requirement; move it to gap_advice.',
                )
            )
    return issues


def fix_keywords_added(plan: OptimizationPlan) -> OptimizationPlan:
    """keywords_added should list only terms the rewrite has and the original lacked."""
    rewrites = [
        rw.model_copy(
            update={
                "keywords_added": [
                    k
                    for k in rw.keywords_added
                    if contains_term(rw.rewritten, k) and not contains_term(rw.original, k)
                ]
            }
        )
        for rw in plan.bullet_rewrites
    ]
    return plan.model_copy(update={"bullet_rewrites": rewrites})


def sanitize_plan(
    plan: OptimizationPlan, job: JobRequirements, analysis: MatchAnalysis, resume_text: str
) -> OptimizationPlan:
    """Last line of defence after the revision budget is spent: drop what the guard rejects."""
    forbidden = {norm(f) for f in unsupported_terms(job, analysis, resume_text)}

    def ok_rewrite(rw) -> bool:
        if not _in_resume(rw.original, resume_text):
            return False
        return not any(
            contains_term(rw.rewritten, f) and not contains_term(rw.original, f) for f in forbidden
        )

    return plan.model_copy(
        update={
            "bullet_rewrites": [rw for rw in plan.bullet_rewrites if ok_rewrite(rw)],
            "keywords_to_add": [k for k in plan.keywords_to_add if norm(k) not in forbidden],
            "skills_to_highlight": [
                s for s in plan.skills_to_highlight if norm(s) not in forbidden
            ],
        }
    )
