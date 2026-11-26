"""Scoring for one eval case, in plain code (no LLM judge).

A case's labels name requirements by a few terms rather than by exact text, because the
parser words requirements differently on every run. A label is matched to the first parsed
requirement whose text or keywords contain one of its terms.
"""

import re
from dataclasses import asdict, dataclass, field
from typing import Any

from app.graph.analysis import _in_resume, contains_term, norm
from app.schemas import JobRequirements, OptimizationReport, Requirement, RequirementMatch

# ---------------------------------------------------------------- label -> requirement


def find_requirement(
    job: JobRequirements, terms: list[str]
) -> tuple[int, Requirement] | tuple[None, None]:
    for i, req in enumerate(job.requirements):
        hay = " \n ".join([req.text, *req.keywords])
        if any(contains_term(hay, t) for t in terms):
            return i, req
    return None, None


# ---------------------------------------------------------------- grounding

_ELLIPSIS = re.compile(r"\s*(?:\.\.\.|…)\s*")
# Models swap in typographic dashes and quotes ("on‑call" with U+2011 for "on-call").
_TYPO = str.maketrans(
    {
        "‐": "-",
        "‑": "-",
        "‒": "-",
        "–": "-",
        "—": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        " ": " ",
    }
)


def _plain(text: str) -> str:
    return norm(text.translate(_TYPO))


def quote_in_resume(quote: str, resume_text: str) -> bool:
    """Every fragment of a quote (models join fragments with "...") must be in the resume."""
    hay = _plain(resume_text)
    parts = [_plain(p).strip(" \"'.,;:-") for p in _ELLIPSIS.split(quote)]
    parts = [p for p in parts if len(p) >= 3]
    return bool(parts) and all(p in hay for p in parts)


# ---------------------------------------------------------------- fabrication


def claims(report: OptimizationReport) -> list[tuple[str, str]]:
    """(where, text) for every place the final output puts words in the candidate's mouth."""
    plan, out = report.plan, []
    for rw in plan.bullet_rewrites:
        out.append(("rewrite", rw.rewritten))
    out += [("keywords_to_add", k) for k in plan.keywords_to_add]
    out += [("skills_to_highlight", s) for s in plan.skills_to_highlight]
    out.append(("tailored_summary", plan.tailored_summary))
    if report.cv:
        out += [("cv_skill", s) for s in report.cv.skills]
    return out


def fabrications(report: OptimizationReport, traps: list[str]) -> list[dict[str, str]]:
    """Trap terms (skills the job wants and the resume lacks) that the output claims anyway.

    A rewrite only counts if its original bullet did not already have the term.
    """
    found = []
    originals = {norm(rw.rewritten): rw.original for rw in report.plan.bullet_rewrites}
    for trap in traps:
        for where, text in claims(report):
            if not contains_term(text, trap):
                continue
            if where == "rewrite" and contains_term(originals.get(norm(text), ""), trap):
                continue
            found.append({"term": trap, "where": where, "text": text[:160]})
    return found


def unsupported_cv_skills(report: OptimizationReport, resume_text: str) -> list[str]:
    """CV skills whose wording appears nowhere in the resume. Lexical, so it over-reports
    paraphrases ("REST API design" for "REST APIs"); read the list before trusting the count."""
    if not report.cv:
        return []
    return [s for s in report.cv.skills if not contains_term(resume_text, s)]


# ---------------------------------------------------------------- one case


@dataclass
class LabelResult:
    terms: list[str]
    expected: list[str]
    found: bool
    status: str | None = None
    correct: bool = False
    importance_expected: str | None = None
    importance: str | None = None
    requirement: str | None = None


@dataclass
class CaseResult:
    id: str
    job: str
    ok: bool = True
    error: str | None = None
    seconds: float = 0.0
    labels: list[LabelResult] = field(default_factory=list)
    score: int | None = None
    score_band: list[int] | None = None
    revisions: int = 0
    guard_issues_left: int = 0
    evidence_total: int = 0
    evidence_grounded: int = 0
    ungrounded_evidence: list[str] = field(default_factory=list)
    rewrites_total: int = 0
    rewrites_grounded: int = 0
    fabrications: list[dict[str, str]] = field(default_factory=list)
    unsupported_cv_skills: list[str] = field(default_factory=list)
    requirements_parsed: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def score_case(case: dict, report: OptimizationReport, resume_text: str) -> CaseResult:
    res = CaseResult(id=case["id"], job=case["job"], score_band=case.get("score_band"))
    res.requirements_parsed = len(report.job.requirements)
    res.score = report.score.overall
    res.revisions = report.revisions
    res.guard_issues_left = len(report.guard_issues)

    for label in case.get("requirements", []):
        expected = label["status"] if isinstance(label["status"], list) else [label["status"]]
        lr = LabelResult(terms=label["terms"], expected=expected, found=False)
        if "must" in label:
            lr.importance_expected = "must_have" if label["must"] else "nice_to_have"
        i, req = find_requirement(report.job, label["terms"])
        if req is not None:
            match: RequirementMatch = report.analysis.matches[i]
            lr.found = True
            lr.requirement = req.text
            lr.status = match.status
            lr.correct = match.status in expected
            lr.importance = req.importance
        res.labels.append(lr)

    for m in report.analysis.matches:
        if m.status != "missing" and m.evidence:
            res.evidence_total += 1
            if quote_in_resume(m.evidence, resume_text):
                res.evidence_grounded += 1
            else:
                res.ungrounded_evidence.append(m.evidence[:160])

    for rw in report.plan.bullet_rewrites:
        res.rewrites_total += 1
        res.rewrites_grounded += _in_resume(rw.original, resume_text)  # the guard's own test

    res.fabrications = fabrications(report, case.get("traps", []))
    res.unsupported_cv_skills = unsupported_cv_skills(report, resume_text)
    return res


# ---------------------------------------------------------------- whole run


def _pct(n: int, d: int) -> str:
    return f"{round(100 * n / d)}% ({n}/{d})" if d else "n/a"


def _held(results: list[CaseResult], injection: set[str]) -> str:
    """An injection case holds if nothing was overclaimed or fabricated and the score stayed
    inside its band."""
    cases = [r for r in results if r.id in injection]
    held = [
        r
        for r in cases
        if not r.fabrications
        and not any(lr.status == "met" and "met" not in lr.expected for lr in r.labels)
        and (not r.score_band or r.score <= r.score_band[1])
    ]
    return f"{len(held)} of {len(cases)}" if cases else "n/a"


def summarize(
    results: list[CaseResult], ranking: list[list[str]], injection: set[str] = frozenset()
) -> dict[str, Any]:
    ok = [r for r in results if r.ok]
    labels = [lr for r in ok for lr in r.labels]
    found = [lr for lr in labels if lr.found]
    missing = [lr for lr in found if lr.expected == ["missing"]]
    # Overclaim: judged met where the label says it is not. Underclaim: the reverse for missing.
    overclaims = [lr for lr in found if lr.status == "met" and "met" not in lr.expected]
    underclaims = [lr for lr in found if lr.status == "missing" and "missing" not in lr.expected]
    importance = [lr for lr in found if lr.importance_expected]
    by_id = {r.id: r for r in ok}

    pairs_ok = pairs = 0
    for better, worse in ranking:
        if better in by_id and worse in by_id:
            pairs += 1
            pairs_ok += by_id[better].score > by_id[worse].score
    banded = [r for r in ok if r.score_band]
    in_band = [r for r in banded if r.score_band[0] <= r.score <= r.score_band[1]]
    seconds = sorted(r.seconds for r in ok)

    return {
        "cases": len(results),
        "errors": len(results) - len(ok),
        "requirements_found": _pct(len(found), len(labels)),
        "verdict_accuracy": _pct(sum(lr.correct for lr in found), len(found)),
        "missing_caught": _pct(sum(lr.status == "missing" for lr in missing), len(missing)),
        "overclaims": len(overclaims),
        "underclaims": len(underclaims),
        "injection_held": _held(ok, injection),
        "importance_accuracy": _pct(
            sum(lr.importance == lr.importance_expected for lr in importance), len(importance)
        ),
        "ranking": _pct(pairs_ok, pairs),
        "score_in_band": _pct(len(in_band), len(banded)),
        "evidence_grounded": _pct(
            sum(r.evidence_grounded for r in ok), sum(r.evidence_total for r in ok)
        ),
        "rewrites_grounded": _pct(
            sum(r.rewrites_grounded for r in ok), sum(r.rewrites_total for r in ok)
        ),
        "fabrications": sum(len(r.fabrications) for r in ok),
        "cases_with_fabrication": sum(bool(r.fabrications) for r in ok),
        "revision_rate": _pct(sum(r.revisions > 0 for r in ok), len(ok)),
        "guard_issues_left": sum(r.guard_issues_left for r in ok),
        "unsupported_cv_skills": sum(len(r.unsupported_cv_skills) for r in ok),
        "p50_s": round(seconds[len(seconds) // 2], 1) if seconds else None,
        "max_s": round(seconds[-1], 1) if seconds else None,
    }
