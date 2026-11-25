"""A scripted stand-in for the LLM so the whole graph runs offline and deterministically."""

from pathlib import Path

import pytest
from langchain_core.runnables import RunnableLambda

from app import llm
from app.schemas import (
    BulletRewrite,
    GapAdvice,
    JobRequirements,
    MatchAnalysis,
    OptimizationPlan,
    Requirement,
    RequirementMatch,
    ResumeProfile,
    Role,
)

SAMPLES = Path(__file__).resolve().parents[1] / "app" / "static" / "samples"
RESUME_TEXT = (SAMPLES / "resume.txt").read_text(encoding="utf-8")
JOB_TEXT = (SAMPLES / "job.txt").read_text(encoding="utf-8")

EMBEDDINGS_BULLET = (
    "Worked on a feature that uses OpenAI embeddings to search customer support tickets."
)

RESUME = ResumeProfile(
    name="Alex Rivera",
    headline="Software Engineer",
    years_experience=4,
    skills=["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    roles=[Role(title="Software Engineer", company="Finlytics", bullets=[EMBEDDINGS_BULLET])],
)

JOB = JobRequirements(
    title="AI Engineer (LLM Applications)",
    company="Northwind Labs",
    seniority="mid",
    requirements=[
        Requirement(
            text="3+ years of Python", category="skill", importance="must_have", keywords=["Python"]
        ),
        Requirement(
            text="Experience with LangChain or LangGraph",
            category="skill",
            importance="must_have",
            keywords=["LangChain", "LangGraph"],
        ),
        Requirement(
            text="Experience with vector databases",
            category="skill",
            importance="must_have",
            keywords=["pgvector", "FAISS"],
        ),
        Requirement(
            text="Kubernetes", category="skill", importance="nice_to_have", keywords=["Kubernetes"]
        ),
    ],
)

# Deliberately returned out of order to exercise align_matches.
ANALYSIS = MatchAnalysis(
    matches=[
        RequirementMatch(requirement="Kubernetes", status="missing", note="Not mentioned."),
        RequirementMatch(
            requirement="3+ years of Python",
            status="met",
            evidence="4 years of experience building Python services",
            note="ok",
        ),
        RequirementMatch(
            requirement="Experience with LangChain or LangGraph",
            status="partial",
            evidence="RAG demo ... using LangChain and FAISS",
            note="Project only.",
        ),
        RequirementMatch(
            requirement="Experience with vector databases",
            status="partial",
            evidence="LangChain and FAISS",
            note="Project only.",
        ),
    ],
    strengths=["Production FastAPI experience"],
)

_BASE_PLAN = {
    "tailored_summary": "Backend engineer with 4 years of Python and production FastAPI APIs.",
    "skills_to_highlight": ["Python", "FastAPI"],
    "gap_advice": [
        GapAdvice(requirement="Kubernetes", advice="Deploy a side project to a k8s cluster.")
    ],
    "ats_tips": ["Use standard section headings."],
}

# First draft fabricates Kubernetes; the revision fixes it.
BAD_PLAN = OptimizationPlan(
    **_BASE_PLAN,
    bullet_rewrites=[
        BulletRewrite(
            original=EMBEDDINGS_BULLET,
            rewritten="Built semantic ticket search with OpenAI embeddings, deployed on Kubernetes.",
            keywords_added=["Kubernetes"],
            reason="Adds infra keyword.",
        )
    ],
    keywords_to_add=["Kubernetes", "embeddings"],
)
GOOD_PLAN = OptimizationPlan(
    **_BASE_PLAN,
    bullet_rewrites=[
        BulletRewrite(
            original=EMBEDDINGS_BULLET,
            rewritten="Built an LLM-powered semantic search over support tickets using OpenAI "
            "embeddings.",
            keywords_added=["LLM"],
            reason="Names the LLM work the JD asks for.",
        )
    ],
    keywords_to_add=["embeddings"],
)


class FakeLLM:
    def __init__(self, plans):
        self.plans = list(plans)
        self.calls: dict[str, list] = {}

    def structured(self, schema, size="large"):
        def respond(messages):
            self.calls.setdefault(schema.__name__, []).append(messages)
            if schema is ResumeProfile:
                return RESUME
            if schema is JobRequirements:
                return JOB
            if schema is MatchAnalysis:
                return ANALYSIS
            if schema is OptimizationPlan:
                return self.plans.pop(0) if len(self.plans) > 1 else self.plans[0]
            raise AssertionError(schema)

        return RunnableLambda(respond)


@pytest.fixture
def fake_llm(monkeypatch):
    fake = FakeLLM([BAD_PLAN, GOOD_PLAN])
    monkeypatch.setattr(llm, "structured", fake.structured)
    return fake
