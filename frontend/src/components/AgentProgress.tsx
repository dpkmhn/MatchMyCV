import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Check,
  FileSearch,
  FileText,
  GitCompareArrows,
  Loader2,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { NodeName, StepEvent } from "../types";
import { Card, cn } from "./ui";

const NODES: { id: NodeName; title: string; detail: string; icon: React.ElementType }[] = [
  { id: "parse_resume", title: "Parse resume", detail: "Roles, bullets, skills", icon: FileText },
  { id: "parse_job", title: "Parse job", detail: "Requirements & ATS terms", icon: FileSearch },
  { id: "match", title: "Match", detail: "Evidence per requirement", icon: GitCompareArrows },
  { id: "score", title: "Score", detail: "Deterministic, in code", icon: Calculator },
  { id: "optimize", title: "Optimize", detail: "Tailored rewrites", icon: PenLine },
  { id: "guard", title: "Honesty guard", detail: "Blocks fabrication", icon: ShieldCheck },
  { id: "finalize", title: "Report", detail: "Assemble results", icon: Sparkles },
];

type Status = "pending" | "running" | "done" | "flagged";

/** Which nodes are running right now, given the events seen so far (mirrors app/graph/builder.py). */
function runningNodes(steps: StepEvent[]): Set<NodeName> {
  const seen = new Set(steps.map((s) => s.node));
  const last = steps.at(-1);
  if (!last) return new Set(["parse_resume", "parse_job"]);
  switch (last.node) {
    case "parse_resume":
    case "parse_job":
      if (seen.has("parse_resume") && seen.has("parse_job")) return new Set(["match"]);
      return new Set([seen.has("parse_resume") ? "parse_job" : "parse_resume"]);
    case "match":
      return new Set(["score"]);
    case "score":
      return new Set(["optimize"]);
    case "optimize":
      return new Set(["guard"]);
    case "guard":
      return new Set([isFlagged(last) ? "optimize" : "finalize"]);
    default:
      return new Set();
  }
}

const isFlagged = (s: StepEvent) => s.node === "guard" && s.label.startsWith("Guard flagged");

export function AgentProgress({
  steps,
  running,
  error,
  startedAt,
}: {
  steps: StepEvent[];
  running: boolean;
  error: string | null;
  startedAt: number;
}) {
  const now = useNow(running);
  const active = running ? runningNodes(steps) : new Set<NodeName>();
  const revisions = steps.filter(isFlagged).length;
  const finishedAt = steps.at(-1)?.at ?? now;
  const elapsed = ((running ? now : finishedAt) - startedAt) / 1000;

  const status = (id: NodeName): Status => {
    if (active.has(id)) return "running";
    const mine = steps.filter((s) => s.node === id);
    if (!mine.length) return "pending";
    return id === "guard" && isFlagged(mine.at(-1)!) ? "flagged" : "done";
  };

  const doneCount = NODES.filter((n) => status(n.id) === "done").length;
  const pct = running ? Math.max(4, (doneCount / NODES.length) * 100) : 100;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          {running ? (
            <Loader2 className="size-5 animate-spin text-brand-500" />
          ) : error ? (
            <AlertTriangle className="size-5 text-rose-500" />
          ) : (
            <Check className="size-5 text-emerald-500" />
          )}
          <div>
            <h2 className="font-semibold tracking-tight">
              {running ? "Agent is working" : error ? "Run failed" : "Analysis complete"}
            </h2>
            <p className="text-xs text-zinc-500">
              {revisions > 0 && `${revisions} revision${revisions > 1 ? "s" : ""} by the guard · `}
              <span className="tabular-nums">{elapsed.toFixed(1)}s</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-5 mt-4 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            error ? "bg-rose-500" : "bg-gradient-to-r from-brand-400 to-brand-600",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 lg:grid-cols-7">
        {NODES.map((n) => {
          const s = status(n.id);
          const Icon = n.icon;
          return (
            <li
              key={n.id}
              className={cn(
                "relative rounded-xl border p-3 transition-all duration-300",
                s === "pending" && "border-zinc-200/70 opacity-50 dark:border-white/5",
                s === "running" &&
                  "border-brand-300 bg-brand-50/70 shadow-md shadow-brand-500/10 dark:border-brand-500/40 dark:bg-brand-500/10",
                s === "done" && "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5",
                s === "flagged" && "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <Icon
                  className={cn(
                    "size-4",
                    s === "running" && "text-brand-600 dark:text-brand-300",
                    s === "done" && "text-emerald-600 dark:text-emerald-400",
                    s === "flagged" && "text-amber-600 dark:text-amber-400",
                    s === "pending" && "text-zinc-400",
                  )}
                />
                {s === "running" && <Loader2 className="size-3.5 animate-spin text-brand-500" />}
                {s === "done" && <Check className="size-3.5 text-emerald-500" />}
                {s === "flagged" && <AlertTriangle className="size-3.5 text-amber-500" />}
              </div>
              <p className="text-xs font-semibold">{n.title}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                {s === "flagged" ? "Sent back for revision" : n.detail}
              </p>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mx-5 mb-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="break-words">{error}</p>
        </div>
      )}
    </Card>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
