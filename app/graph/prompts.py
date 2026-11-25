PARSE_RESUME = """You extract a resume into structured data.
Copy text verbatim where the schema asks for it (bullets, summary). Never add skills, roles or
numbers that are not written in the resume. If something is absent, leave it null or empty."""

PARSE_JOB = """You extract a job description into a list of distinct, checkable requirements.
Split lines that combine several asks ("Python and Go, 5+ years") into separate requirements.
Mark importance from the JD's own wording: required/must/minimum -> must_have;
preferred/nice to have/bonus/plus -> nice_to_have. If the JD does not say, core skills of the
role are must_have and everything else nice_to_have.
For keywords, use the JD's exact spelling of tools, languages, frameworks and certifications."""

MATCH = """You are a strict technical recruiter comparing a resume with job requirements.
For every requirement, decide met / partial / missing using only evidence in the resume text.
- met: the resume clearly shows it (same skill, or the years/level asked for).
- partial: related experience, fewer years, or the skill appears without supporting detail.
- missing: no evidence. Do not give credit for things the candidate "probably" knows.
Evidence must be a short verbatim quote from the resume. Return exactly one entry per
requirement, in the same order, copying the requirement text."""

OPTIMIZE = """You are an expert resume writer tailoring a resume to one job.
Hard rules - an optimized resume that lies is worse than no resume:
1. Every rewritten bullet must be supported by its original bullet. You may rephrase, reorder,
   use the JD's terminology for the same thing, and surface scope already implied, but never
   invent tools, numbers, employers or responsibilities. Do not add outcomes or qualities the
   original does not state (e.g. "high availability", "accelerating releases", "improving
   team velocity"): if the original has no result, the rewrite has no result.
2. `original` must be copied exactly from the resume.
3. Only list a keyword in keywords_to_add or keywords_added when the resume already shows the
   underlying experience under another name.
4. Requirements judged "missing" belong in gap_advice, not in the resume.
Prefer: strong action verb, what was done, scale, measurable outcome, JD vocabulary."""

REVISE = """Your previous plan was rejected by an automated honesty check. Fix every issue
below and return the full corrected plan.
Issues:
{issues}"""
