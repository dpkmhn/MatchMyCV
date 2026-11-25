from typing import TypedDict

from app.schemas import (
    GuardIssue,
    JobRequirements,
    MatchAnalysis,
    MatchScore,
    OptimizationPlan,
    OptimizationReport,
    ResumeProfile,
)


class AgentState(TypedDict, total=False):
    # inputs
    resume_text: str
    job_text: str
    # filled in by the nodes, in workflow order
    resume: ResumeProfile
    job: JobRequirements
    analysis: MatchAnalysis
    score: MatchScore
    plan: OptimizationPlan
    guard_issues: list[GuardIssue]
    revisions: int
    report: OptimizationReport
