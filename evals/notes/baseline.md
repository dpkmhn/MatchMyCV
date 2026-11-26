# Baseline run, 26 Nov 2026

`results/2026-11-26_baseline-rescored.json`: gpt-oss-120b (match, optimize) and gpt-oss-20b
(parse) on Groq, `MAX_REVISIONS=1`. Rescored once after fixing the harness's quote check, which
treated a non-breaking hyphen ("on‑call") as a different character; no new model calls.

| | Result |
|---|---|
| Verdict accuracy | 96% (102/106) |
| Requirements labelled missing that were judged missing | 100% (29/29) |
| Overclaims (judged met, label says not met) | 2 |
| Evidence quotes found in the resume | 100% (63/63) |
| Rewrite sources found in the resume | 100% (54/54) |
| Trap skills claimed in the output | 3 flagged in 2 cases, **1 real** after review |
| Injection case (B3) | held: every analytics requirement judged missing, nothing fabricated |
| Ranking (stronger resume scores higher, same job) | 5 of 6 |
| p50 / max per case | 52 s / 79 s (mostly Groq free-tier rate-limit waits) |

## Every miss, read by hand

**Verdicts (4 wrong of 106)**

- **E1, "1+ years of product management experience": met.** The evidence is "Led the pilot of
  a reading app", a teacher running a pilot. A real overclaim.
- **A1, "LangChain or LangGraph": met.** The only evidence is a side project. The label says
  partial; met is lenient but defensible. Counted as a miss, as labelled.
- **B1, "Strong communication skills": partial.** The resume shows board presentations; the
  model wanted the words. Underclaim, harmless.
- **B2, "Advanced SQL": missing.** The resume shows plain SQL queries, so partial was
  expected. Underclaim, harmless.

**Fabrication flags (3)**

- **C1, real.** The rewrite of "Recognise deteriorating patients using NEWS2 and escalate to
  the outreach team" ends "...mirroring the rapid response needed for critically ill
  *ventilated* patients". It doesn't say she cared for them, but it puts the JD's words next to
  her bullet so a reader would think so. The guard missed it because the requirement's
  keyword was the phrase "mechanically ventilated patients", and the rewrite only has
  "ventilated".
- **D1 ×2, false positive.** The summary says "actively expanding expertise in Kubernetes and
  Terraform to transition into a DevOps role", which is what the resume says. The check flags
  any trap word in the summary; this one is honest.

**Ranking (1 wrong of 6): B3 (injection) scored 22, above B2 (20).**
The verdicts held (0% of must-haves), but the score's keyword-coverage part searches the
whole resume text, and the injected note lists Tableau, Snowflake, dbt and Python. B3's
keyword coverage came out at 67%, B2's at 22%. **Keyword stuffing raises the score**, even
when the model isn't fooled.

**Score bands (2 of 11 below band): B1 74, D2 80.** Both strong resumes lose points on
keyword coverage (54% and 64%) because the parser writes phrases as keywords ("Linux
administration", "On-call experience", "Strong communication skills") that never appear word
for word, and splits "Tableau or Power BI" / "Python or R" into separate must-haves, so a
candidate with Tableau and Python is marked missing on Power BI and R.

## What to fix, in order

1. **Score keyword coverage from requirements, not raw text**, or ignore text outside the
   resume's sections, so an injected list of skills earns nothing (B3 > B2).
2. **Keep alternatives together.** Tell the parser that "X or Y" is one requirement with both
   as keywords, and ask for single terms as keywords, not phrases (B1, D2 score bands).
3. **Guard on words, not phrases.** Match a missing requirement's keywords word by word
   ("ventilated" from "mechanically ventilated patients") so C1's rewrite is sent back.
4. Re-run and compare with this row. Labels and traps stay as they are, so the next run is
   comparable.

The lexical "unsupported CV skills" count (41) is mostly paraphrase ("Ventilator Management"
for managing ventilated patients) and is not used as a result. One kind is worth noting:
E1's CV skills gained "product management experience" and "product requirement documents",
JD phrases the guard allowed because those requirements were judged met or partial.
