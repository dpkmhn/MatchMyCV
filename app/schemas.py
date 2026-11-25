"""Pydantic models for every structured step of the workflow.

The LLM-facing models (ResumeProfile, JobRequirements, MatchAnalysis, OptimizationPlan) are
passed to `with_structured_output`, so their field descriptions double as instructions.
MatchScore and GuardIssue are computed in code, never by the model.
"""

from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- 1. parsed inputs


class Role(BaseModel):
    title: str
    company: str
    dates: str | None = Field(None, description='As written, e.g. "Jan 2021 - Present"')
    bullets: list[str] = Field(
        default_factory=list, description="Achievement bullets copied verbatim from the resume"
    )


class ResumeProfile(BaseModel):
    """Structured view of the candidate's resume. Only what the resume states."""

    name: str | None = None
    headline: str | None = Field(None, description="Current title or headline line")
    contact: list[str] = Field(
        default_factory=list,
        description="Email, phone, location and profile links, each exactly as written",
    )
    summary: str | None = Field(None, description="The summary/objective paragraph, verbatim")
    years_experience: float | None = Field(
        None, description="Total professional years, computed from the role dates if possible"
    )
    skills: list[str] = Field(
        default_factory=list,
        description="Every technical/tool/domain skill mentioned anywhere in the resume",
    )
    roles: list[Role] = Field(default_factory=list, description="Most recent first")
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list, description="One line per project")


Importance = Literal["must_have", "nice_to_have"]
Category = Literal["skill", "experience", "education", "certification", "domain", "soft_skill"]


class Requirement(BaseModel):
    text: str = Field(description="The requirement in a short phrase, e.g. '5+ years of Python'")
    category: Category
    importance: Importance = Field(
        description="must_have if the JD says required/must/minimum; nice_to_have for "
        "preferred/bonus/plus"
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="Exact terms an ATS would scan for, as written in the JD (e.g. 'Kubernetes')",
    )


class JobRequirements(BaseModel):
    """Structured view of the job description."""

    title: str
    company: str | None = None
    seniority: Literal["intern", "junior", "mid", "senior", "lead", "principal", "unknown"]
    requirements: list[Requirement] = Field(
        description="Every distinct requirement; split combined lines into separate items"
    )
    responsibilities: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------- 2. matching

MatchStatus = Literal["met", "partial", "missing"]


class RequirementMatch(BaseModel):
    requirement: str = Field(description="Copy of the requirement text being judged")
    status: MatchStatus = Field(
        description="met: clearly shown. partial: related or weaker evidence. missing: no evidence"
    )
    evidence: str | None = Field(
        None,
        description="Short verbatim quote from the resume that supports the status. Null if "
        "missing",
    )
    note: str = Field(description="One sentence on why this status was chosen")


class MatchAnalysis(BaseModel):
    matches: list[RequirementMatch] = Field(description="Exactly one entry per requirement")
    strengths: list[str] = Field(
        description="2-5 things in the resume that make this candidate stand out for the role"
    )


class MatchScore(BaseModel):
    """Deterministic score computed in code from MatchAnalysis + keyword scan."""

    overall: int = Field(ge=0, le=100)
    must_have: int = Field(ge=0, le=100, description="% of must-have requirements met")
    nice_to_have: int = Field(ge=0, le=100)
    keyword_coverage: int = Field(
        ge=0, le=100, description="% of requirements with at least one of their JD terms in the resume"
    )
    matched_keywords: list[str]
    missing_keywords: list[str]


# ---------------------------------------------------------------- 3. optimization


class BulletRewrite(BaseModel):
    original: str = Field(description="The resume bullet exactly as it appears in the resume")
    rewritten: str = Field(
        description="Stronger version: action verb, scope, measurable result, JD wording. "
        "Must not claim anything the original does not support"
    )
    keywords_added: list[str] = Field(
        default_factory=list, description="JD keywords the rewrite now contains"
    )
    reason: str = Field(description="One sentence on what changed and why it helps for this job")


class GapAdvice(BaseModel):
    requirement: str
    advice: str = Field(
        description="Honest way to close or address the gap: a project, course, certification, "
        "or how to frame adjacent experience. Never suggest claiming the skill outright"
    )


class OptimizationPlan(BaseModel):
    tailored_summary: str = Field(
        description="A 2-4 sentence professional summary targeted at this job, built only from "
        "facts in the resume"
    )
    bullet_rewrites: list[BulletRewrite] = Field(
        description="The 4-8 bullets whose rewrite would most improve fit for this job"
    )
    skills_to_highlight: list[str] = Field(
        description="Skills the candidate already has that should move to the top of the "
        "skills section for this job"
    )
    keywords_to_add: list[str] = Field(
        description="Missing JD keywords that the candidate's existing experience genuinely "
        "supports, so they can be added honestly"
    )
    gap_advice: list[GapAdvice] = Field(description="One entry per important missing requirement")
    ats_tips: list[str] = Field(
        description="2-5 concrete formatting/structure tips for applicant tracking systems"
    )


# ---------------------------------------------------------------- 4. guard + final report


class GuardIssue(BaseModel):
    kind: Literal["unknown_original", "unsupported_keyword", "missing_skill_claimed"]
    detail: str


class OptimizationReport(BaseModel):
    resume: ResumeProfile
    job: JobRequirements
    analysis: MatchAnalysis
    score: MatchScore
    plan: OptimizationPlan
    guard_issues: list[GuardIssue] = Field(
        default_factory=list, description="Problems the guard still saw after the last revision"
    )
    revisions: int = 0
    cv: "TailoredCV | None" = Field(
        None, description="The resume rebuilt with the plan's accepted suggestions applied"
    )


# ---------------------------------------------------------------- 5. the new CV


class CVRole(BaseModel):
    title: str
    company: str
    dates: str | None = Field(None, description="As written, e.g. 'Jun 2022 - Present'")
    bullets: list[str] = Field(default_factory=list)


class TailoredCV(BaseModel):
    """The full, ready-to-send resume. Every fact must come from the candidate."""

    name: str
    headline: str | None = None
    contact: list[str] = Field(default_factory=list, description="Email, phone, location, links")
    summary: str = ""
    skills: list[str] = Field(default_factory=list, description="Most relevant first")
    experience: list[CVRole] = Field(default_factory=list, description="Most recent first")
    projects: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class CVEdit(BaseModel):
    """LLM output for one prompt-driven edit of the CV."""

    cv: TailoredCV = Field(description="The complete CV after applying the instruction")
    change_summary: str = Field(
        description="One short sentence describing what was changed, or why nothing could be "
        "changed honestly"
    )


OptimizationReport.model_rebuild()
