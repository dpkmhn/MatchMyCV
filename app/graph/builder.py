"""The LangGraph workflow.

START ─┬─ parse_resume ─┐
       └─ parse_job ────┴─ match ─ score ─ optimize ─ guard ─┬─ finalize ─ END
                                              ▲               │
                                              └── revise ─────┘  (issues & budget left)
"""

from functools import lru_cache
from typing import Literal

from langgraph.graph import END, START, StateGraph

from app.config import get_settings
from app.graph import nodes
from app.graph.state import AgentState
from app.schemas import OptimizationReport


def route_after_guard(state: AgentState) -> Literal["optimize", "finalize"]:
    if state.get("guard_issues") and state.get("revisions", 0) < get_settings().max_revisions:
        return "optimize"
    return "finalize"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("parse_resume", nodes.parse_resume)
    g.add_node("parse_job", nodes.parse_job)
    g.add_node("match", nodes.match)
    g.add_node("score", nodes.score)
    g.add_node("optimize", nodes.optimize)
    g.add_node("guard", nodes.guard)
    g.add_node("finalize", nodes.finalize)

    # The two documents are parsed in parallel; match waits for both.
    g.add_edge(START, "parse_resume")
    g.add_edge(START, "parse_job")
    g.add_edge(["parse_resume", "parse_job"], "match")
    g.add_edge("match", "score")
    g.add_edge("score", "optimize")
    g.add_edge("optimize", "guard")
    g.add_conditional_edges("guard", route_after_guard, ["optimize", "finalize"])
    g.add_edge("finalize", END)
    return g.compile()


@lru_cache
def get_graph():
    return build_graph()


async def run(resume_text: str, job_text: str) -> OptimizationReport:
    state = await get_graph().ainvoke(
        {"resume_text": resume_text, "job_text": job_text, "revisions": 0}
    )
    return state["report"]
