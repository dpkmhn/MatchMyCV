import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app import llm
from app.cv import build_cv
from app.graph import analysis as an
from app.graph import prompts
from app.graph.state import AgentState
from app.schemas import (
    JobRequirements,
    MatchAnalysis,
    OptimizationPlan,
    OptimizationReport,
    ResumeProfile,
)

log = logging.getLogger(__name__)


def _dump(model) -> str:
    return json.dumps(model.model_dump(), indent=1, ensure_ascii=False)


# ------------------------------------------------------------------ LLM nodes


async def parse_resume(state: AgentState) -> AgentState:
    runnable = llm.structured(ResumeProfile, "small")
    resume = await runnable.ainvoke(
        [
            SystemMessage(prompts.PARSE_RESUME),
            HumanMessage(f"<resume>\n{state['resume_text']}\n</resume>"),
        ]
    )
    log.info("parsed resume: %d roles, %d skills", len(resume.roles), len(resume.skills))
    return {"resume": resume}


async def parse_job(state: AgentState) -> AgentState:
    runnable = llm.structured(JobRequirements, "small")
    job = await runnable.ainvoke(
        [
            SystemMessage(prompts.PARSE_JOB),
            HumanMessage(f"<job_description>\n{state['job_text']}\n</job_description>"),
        ]
    )
    log.info("parsed job: %s, %d requirements", job.title, len(job.requirements))
    return {"job": job}


async def match(state: AgentState) -> AgentState:
    job = state["job"]
    numbered = "\n".join(
        f"{i}. [{r.importance}] {r.text}" for i, r in enumerate(job.requirements, 1)
    )
    runnable = llm.structured(MatchAnalysis, "large")
    raw = await runnable.ainvoke(
        [
            SystemMessage(prompts.MATCH),
            HumanMessage(
                f"<resume>\n{state['resume_text']}\n</resume>\n\n"
                f"<job title=\"{job.title}\">\n{numbered}\n</job>"
            ),
        ]
    )
    return {"analysis": an.align_matches(job, raw)}


async def optimize(state: AgentState) -> AgentState:
    revisions = state.get("revisions", 0)
    issues = state.get("guard_issues") or []
    messages = [
        SystemMessage(prompts.OPTIMIZE),
        HumanMessage(
            f"<resume>\n{state['resume_text']}\n</resume>\n\n"
            f"<job>\n{_dump(state['job'])}\n</job>\n\n"
            f"<match_analysis>\n{_dump(state['analysis'])}\n</match_analysis>\n\n"
            f"<score>\n{_dump(state['score'])}\n</score>"
        ),
    ]
    if issues:
        # Revision pass: show the model its rejected plan and exactly what was wrong with it.
        messages.append(HumanMessage(f"<previous_plan>\n{_dump(state['plan'])}\n</previous_plan>"))
        messages.append(
            HumanMessage(
                prompts.REVISE.format(issues="\n".join(f"- {i.detail}" for i in issues))
            )
        )
        revisions += 1
    plan = await llm.structured(OptimizationPlan, "large").ainvoke(messages)
    return {"plan": plan, "revisions": revisions}


# ------------------------------------------------------------------ deterministic nodes


def score(state: AgentState) -> AgentState:
    return {"score": an.compute_score(state["job"], state["analysis"], state["resume_text"])}


def guard(state: AgentState) -> AgentState:
    issues = an.check_plan(state["plan"], state["job"], state["analysis"], state["resume_text"])
    if issues:
        log.info("guard found %d issue(s) after %d revision(s)", len(issues), state["revisions"])
    return {"guard_issues": issues}


def finalize(state: AgentState) -> AgentState:
    plan = state["plan"]
    if state.get("guard_issues"):
        plan = an.sanitize_plan(plan, state["job"], state["analysis"], state["resume_text"])
    plan = an.fix_keywords_added(plan)
    report = OptimizationReport(
        resume=state["resume"],
        job=state["job"],
        analysis=state["analysis"],
        score=state["score"],
        plan=plan,
        guard_issues=state.get("guard_issues") or [],
        revisions=state.get("revisions", 0),
        cv=build_cv(state["resume"], plan),
    )
    return {"report": report}
