"""A scripted model built from a case's labels, so `run_eval --fake` checks the harness offline.

Fake runs say nothing about model quality. They show that the cases load, labels find their
requirements, the guard and revision loop run, and the scoring and reports work.
The first plan claims the case's first trap; the guard should send it back unless the trap
word is in the resume (as in B3), where the fabrication survives, as it would for a real model.
"""

from langchain_core.runnables import RunnableLambda

from app.schemas import (
    BulletRewrite,
    JobRequirements,
    MatchAnalysis,
    OptimizationPlan,
    Requirement,
    RequirementMatch,
    ResumeProfile,
    Role,
)
from evals.metrics import contains_term


def _bullets(resume_text: str) -> list[str]:
    return [ln.strip()[2:] for ln in resume_text.splitlines() if ln.strip().startswith("- ")]


class FakeLLM:
    def __init__(self, case: dict, resume_text: str):
        self.case, self.resume_text = case, resume_text
        self.bullets = _bullets(resume_text)
        self.plan_calls = 0

    def _resume(self) -> ResumeProfile:
        name = next(ln.strip() for ln in self.resume_text.splitlines() if ln.strip())
        return ResumeProfile(
            name=name, roles=[Role(title="Role", company="Co", bullets=self.bullets)]
        )

    def _job(self) -> JobRequirements:
        reqs = [
            Requirement(
                text=f"{lb['terms'][0]} experience",
                category="skill",
                importance="must_have" if lb.get("must", True) else "nice_to_have",
                keywords=[lb["terms"][0]],
            )
            for lb in self.case.get("requirements", [])
        ]
        return JobRequirements(title=self.case["job"], seniority="mid", requirements=reqs)

    def _analysis(self) -> MatchAnalysis:
        matches = []
        for lb in self.case.get("requirements", []):
            status = lb["status"][0] if isinstance(lb["status"], list) else lb["status"]
            evidence = None
            if status != "missing":
                evidence = next(
                    (b for b in self.bullets if any(contains_term(b, t) for t in lb["terms"])),
                    None,
                )
            matches.append(
                RequirementMatch(
                    requirement=f"{lb['terms'][0]} experience",
                    status=status,
                    evidence=evidence,
                    note="scripted",
                )
            )
        return MatchAnalysis(matches=matches, strengths=["scripted"])

    def _plan(self) -> OptimizationPlan:
        self.plan_calls += 1
        traps = self.case.get("traps") or []
        first = self.bullets[0] if self.bullets else ""
        dirty = self.plan_calls == 1 and traps and first
        rewrites = []
        if first:
            rewritten = f"{first} using {traps[0]}" if dirty else f"Delivered: {first}"
            rewrites.append(BulletRewrite(original=first, rewritten=rewritten, reason="scripted"))
        return OptimizationPlan(
            tailored_summary="Experienced professional.",
            bullet_rewrites=rewrites,
            skills_to_highlight=[],
            keywords_to_add=[traps[0]] if dirty else [],
            gap_advice=[],
            ats_tips=["Use standard section headings."],
        )

    def structured(self, schema, size="large"):
        handlers = {
            ResumeProfile: self._resume,
            JobRequirements: self._job,
            MatchAnalysis: self._analysis,
            OptimizationPlan: self._plan,
        }
        return RunnableLambda(lambda _messages: handlers[schema]())
