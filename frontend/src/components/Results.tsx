import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  Award,
  CircleCheck,
  CircleDashed,
  CircleX,
  Download,
  FileUser,
  KeyRound,
  Lightbulb,
  ListChecks,
  PenLine,
  Quote,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import type { MatchStatus, OptimizationReport, Requirement, RequirementMatch } from "../types";
import { CVStudio } from "./CVStudio";
import { Badge, Button, Card, Chips, CopyButton, SectionTitle, cn, scoreTone, type Tone } from "./ui";

type Tab = "overview" | "cv" | "requirements" | "rewrites" | "gaps";

export function Results({
  report,
  markdown,
  cvId,
}: {
  report: OptimizationReport;
  markdown: string;
  cvId: string | null;
}) {
  // The CV is the main deliverable, so it opens first when there is one.
  const [tab, setTab] = useState<Tab>(cvId ? "cv" : "overview");
  const { job, analysis, plan } = report;
  const rows = useMemo(
    () => job.requirements.map((req, i) => ({ req, match: analysis.matches[i] })),
    [job.requirements, analysis.matches],
  );

  const tabs: { id: Tab; label: string; count?: number; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Target },
    ...(cvId ? [{ id: "cv" as const, label: "New CV", icon: FileUser }] : []),
    { id: "requirements", label: "Requirements", count: rows.length, icon: ListChecks },
    { id: "rewrites", label: "Rewrites", count: plan.bullet_rewrites.length, icon: PenLine },
    { id: "gaps", label: "Gaps & ATS", count: plan.gap_advice.length, icon: Lightbulb },
  ];

  return (
    <div className="space-y-5">
      <ScoreHero report={report} markdown={markdown} rows={rows} onOpenCV={cvId ? () => setTab("cv") : undefined} />

      <div className="sticky top-16 z-20 -mx-1 overflow-x-auto px-1 py-2 backdrop-blur-xl">
        <div role="tablist" className="inline-flex gap-1 rounded-xl border border-zinc-200 bg-white/80 p-1 dark:border-white/10 dark:bg-zinc-900/80">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  tab === t.id
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5",
                )}
              >
                <Icon className="size-4" />
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      tab === t.id ? "bg-white/20 dark:bg-zinc-900/10" : "bg-zinc-100 dark:bg-white/10",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div key={tab} className="animate-fade-up">
        {tab === "overview" && <Overview report={report} />}
        {tab === "cv" && cvId && <CVStudio cvId={cvId} />}
        {tab === "requirements" && <Requirements rows={rows} />}
        {tab === "rewrites" && <Rewrites report={report} />}
        {tab === "gaps" && <Gaps report={report} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hero

function ScoreHero({
  report,
  markdown,
  rows,
  onOpenCV,
}: {
  report: OptimizationReport;
  markdown: string;
  rows: { req: Requirement; match: RequirementMatch }[];
  onOpenCV?: () => void;
}) {
  const { score, job, resume } = report;
  const counts = countStatuses(rows.map((r) => r.match));
  const verdict =
    score.overall >= 75 ? "Strong match" : score.overall >= 50 ? "Promising match" : "Stretch role";

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-optimization.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="animate-fade-up relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <ScoreRing value={score.overall} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={scoreTone(score.overall)}>{verdict}</Badge>
            <Badge tone="neutral" className="capitalize">
              {job.seniority}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h2>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {job.company ?? "Company not stated"}
            {resume.name && (
              <>
                {" · for "}
                <span className="font-medium text-zinc-700 capitalize dark:text-zinc-300">
                  {resume.name.toLowerCase()}
                </span>
              </>
            )}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric label="Must-haves" value={score.must_have} />
            <Metric label="Nice-to-haves" value={score.nice_to_have} />
            <Metric label="ATS keywords" value={score.keyword_coverage} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="good"><CircleCheck className="size-3" />{counts.met} met</Badge>
              <Badge tone="warn"><CircleDashed className="size-3" />{counts.partial} partial</Badge>
              <Badge tone="bad"><CircleX className="size-3" />{counts.missing} missing</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={download}>
                <Download className="size-4" />
                Download report
              </Button>
              {onOpenCV && (
                <Button variant="primary" onClick={onOpenCV}>
                  <FileUser className="size-4" />
                  View new CV
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const toneStroke: Record<Tone, string> = {
  good: "stroke-emerald-500",
  warn: "stroke-amber-500",
  bad: "stroke-rose-500",
  neutral: "stroke-zinc-400",
  brand: "stroke-brand-500",
};
const toneBar: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  neutral: "bg-zinc-400",
  brand: "bg-brand-500",
};

function ScoreRing({ value }: { value: number }) {
  const shown = useCountUp(value);
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Overall match ${value} of 100`}>
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-white/5" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn(toneStroke[scoreTone(value)], "transition-[stroke-dasharray] duration-1000 ease-out")}
          strokeDasharray={`${(c * shown) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-5xl font-semibold tracking-tighter tabular-nums">{shown}</div>
          <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Match score</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", toneBar[scoreTone(value)])}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- overview

function Overview({ report }: { report: OptimizationReport }) {
  const { score, plan, analysis } = report;
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <Card className="p-5">
          <SectionTitle icon={<Quote className="size-4" />} action={<CopyButton text={plan.tailored_summary} />}>
            Tailored summary
          </SectionTitle>
          <p className="rounded-xl bg-gradient-to-br from-brand-50 to-transparent p-4 leading-relaxed text-zinc-700 dark:from-brand-500/10 dark:text-zinc-200">
            {plan.tailored_summary}
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={<Award className="size-4" />}>Your strengths for this role</SectionTitle>
          <ul className="space-y-2.5">
            {analysis.strengths.map((s) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>

        {report.guard_issues.length > 0 && <GuardNotice report={report} />}
      </div>

      <Card className="h-fit space-y-5 p-5 lg:col-span-2">
        <SectionTitle icon={<KeyRound className="size-4" />}>ATS keywords</SectionTitle>
        <KeywordGroup title="Found in your resume" items={score.matched_keywords} tone="good" />
        <KeywordGroup title="Missing from your resume" items={score.missing_keywords} tone="bad" />
        {plan.keywords_to_add.length > 0 && (
          <KeywordGroup title="You can honestly add" items={plan.keywords_to_add} tone="brand" />
        )}
        <KeywordGroup title="Skills to lead with" items={plan.skills_to_highlight} tone="neutral" />
      </Card>
    </div>
  );
}

function KeywordGroup({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  return (
    <div>
      <p className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {title}
        <span className="tabular-nums">{items.length}</span>
      </p>
      <Chips items={items} tone={tone} />
    </div>
  );
}

function GuardNotice({ report }: { report: OptimizationReport }) {
  return (
    <Card className="border-amber-300/70 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/5">
      <SectionTitle icon={<ShieldAlert className="size-4 text-amber-600" />}>
        Honesty guard removed {report.guard_issues.length} item{report.guard_issues.length > 1 && "s"}
      </SectionTitle>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        After {report.revisions} revision{report.revisions !== 1 && "s"}, these suggestions still claimed
        things your resume does not show, so they were dropped.
      </p>
      <ul className="space-y-1.5 text-sm">
        {report.guard_issues.map((i) => (
          <li key={i.detail} className="flex gap-2">
            <span className="text-amber-500">•</span>
            {i.detail}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- requirements

const statusMeta: Record<MatchStatus, { tone: Tone; icon: React.ElementType; label: string }> = {
  met: { tone: "good", icon: CircleCheck, label: "Met" },
  partial: { tone: "warn", icon: CircleDashed, label: "Partial" },
  missing: { tone: "bad", icon: CircleX, label: "Missing" },
};

function Requirements({ rows }: { rows: { req: Requirement; match: RequirementMatch }[] }) {
  const [filter, setFilter] = useState<MatchStatus | "all">("all");
  const [mustOnly, setMustOnly] = useState(false);
  const counts = countStatuses(rows.map((r) => r.match));
  const shown = rows.filter(
    (r) =>
      (filter === "all" || r.match.status === filter) &&
      (!mustOnly || r.req.importance === "must_have"),
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "met", "partial", "missing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
                filter === f
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-white/10 dark:text-zinc-400",
              )}
            >
              {f} <span className="tabular-nums opacity-60">{f === "all" ? rows.length : counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={mustOnly}
            onChange={(e) => setMustOnly(e.target.checked)}
            className="size-3.5 accent-brand-600"
          />
          Must-haves only
        </label>
      </div>

      <ul className="divide-y divide-zinc-100 dark:divide-white/5">
        {shown.map(({ req, match }) => {
          const m = statusMeta[match.status];
          const Icon = m.icon;
          return (
            <li key={req.text} className="grid gap-3 py-4 sm:grid-cols-[110px_1fr]">
              <div>
                <Badge tone={m.tone}>
                  <Icon className="size-3" />
                  {m.label}
                </Badge>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{req.text}</p>
                  {req.importance === "must_have" ? (
                    <span className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-400">
                      Must-have
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">Nice-to-have</span>
                  )}
                </div>
                {match.evidence && (
                  <blockquote className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm text-zinc-600 italic dark:border-white/15 dark:text-zinc-300">
                    “{match.evidence}”
                  </blockquote>
                )}
                <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{match.note}</p>
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="py-8 text-center text-sm text-zinc-500">Nothing matches this filter.</li>}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- rewrites

function Rewrites({ report }: { report: OptimizationReport }) {
  const rewrites = report.plan.bullet_rewrites;
  if (!rewrites.length)
    return (
      <Card className="p-10 text-center text-sm text-zinc-500">No safe rewrites were produced for this job.</Card>
    );
  return (
    <div className="grid gap-4">
      {rewrites.map((b, i) => (
        <Card key={b.original} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Bullet {i + 1}</span>
            <CopyButton text={b.rewritten} label="Copy rewrite" />
          </div>
          <p className="text-sm text-zinc-500 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-600">
            {b.original}
          </p>
          <div className="my-2 flex items-center gap-2 text-brand-500">
            <ArrowDown className="size-4" />
          </div>
          <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 font-medium leading-relaxed dark:border-emerald-500/20 dark:bg-emerald-500/5">
            {b.rewritten}
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2 text-sm">
            <p className="flex flex-1 gap-2 text-zinc-500 dark:text-zinc-400">
              <TrendingUp className="mt-0.5 size-4 shrink-0" />
              {b.reason}
            </p>
            {b.keywords_added.length > 0 && <Chips items={b.keywords_added} tone="brand" />}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- gaps

function Gaps({ report }: { report: OptimizationReport }) {
  const { plan } = report;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon={<Lightbulb className="size-4" />}>Closing the gaps</SectionTitle>
        {plan.gap_advice.length ? (
          <ul className="space-y-4">
            {plan.gap_advice.map((g) => (
              <li key={g.requirement} className="rounded-xl border border-zinc-200/70 p-4 dark:border-white/5">
                <p className="flex items-center gap-2 font-medium">
                  <CircleX className="size-4 text-rose-500" />
                  {g.requirement}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{g.advice}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No significant gaps. Nice.</p>
        )}
      </Card>
      <Card className="h-fit p-5">
        <SectionTitle icon={<ListChecks className="size-4" />}>ATS formatting tips</SectionTitle>
        <ol className="space-y-3">
          {plan.ats_tips.map((t, i) => (
            <li key={t} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- helpers

function countStatuses(matches: (RequirementMatch | undefined)[]) {
  const c = { met: 0, partial: 0, missing: 0 };
  for (const m of matches) if (m) c[m.status]++;
  return c;
}

function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
