"""Render an OptimizationReport as Markdown (CLI output and the web page's download)."""

from app.schemas import OptimizationReport

_ICON = {"met": "✅", "partial": "🟡", "missing": "❌"}


def to_markdown(r: OptimizationReport) -> str:
    s, p, job = r.score, r.plan, r.job
    out: list[str] = []
    add = out.append

    company = f" at {job.company}" if job.company else ""
    add(f"# Resume optimization: {job.title}{company}\n")
    add(f"**Overall match: {s.overall}/100**  ")
    add(
        f"Must-haves {s.must_have}% · Nice-to-haves {s.nice_to_have}% · "
        f"ATS keyword coverage {s.keyword_coverage}%\n"
    )

    add("## Strengths\n")
    out += [f"- {x}" for x in r.analysis.strengths]

    add("\n## Requirement match\n")
    add("| | Requirement | Importance | Evidence |")
    add("|---|---|---|---|")
    for req, m in zip(job.requirements, r.analysis.matches, strict=True):
        ev = (m.evidence or m.note).replace("|", "\\|")
        add(f"| {_ICON[m.status]} | {req.text} | {req.importance.replace('_', ' ')} | {ev} |")

    add("\n## Tailored summary\n")
    add(p.tailored_summary)

    add("\n## Bullet rewrites\n")
    for i, b in enumerate(p.bullet_rewrites, 1):
        add(f"**{i}.** ~~{b.original}~~  ")
        add(f"→ {b.rewritten}  ")
        kws = f" _(adds: {', '.join(b.keywords_added)})_" if b.keywords_added else ""
        add(f"<sub>{b.reason}{kws}</sub>\n")

    if p.skills_to_highlight:
        add("## Skills to move to the top\n")
        add(", ".join(p.skills_to_highlight) + "\n")
    if p.keywords_to_add:
        add("## Keywords you can honestly add\n")
        add(", ".join(p.keywords_to_add) + "\n")
    if s.missing_keywords:
        add("## JD keywords not found in your resume\n")
        add(", ".join(s.missing_keywords) + "\n")

    if p.gap_advice:
        add("## Closing the gaps\n")
        out += [f"- **{g.requirement}**: {g.advice}" for g in p.gap_advice]

    if p.ats_tips:
        add("\n## ATS tips\n")
        out += [f"- {t}" for t in p.ats_tips]

    if r.guard_issues:
        add("\n## Removed by the honesty guard\n")
        out += [f"- {i.detail}" for i in r.guard_issues]

    return "\n".join(out) + "\n"
