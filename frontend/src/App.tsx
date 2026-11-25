import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileText, PencilLine, RotateCcw } from "lucide-react";
import { checkHealth, optimize } from "./api";
import { randomSample } from "./samples";
import type { OptimizationReport, StepEvent } from "./types";
import { Header } from "./components/Header";
import { InputPanel, type ResumeMode } from "./components/InputPanel";
import { AgentProgress } from "./components/AgentProgress";
import { Results } from "./components/Results";
import { CVStudio } from "./components/CVStudio";
import { Button, Card } from "./components/ui";

type Phase = "input" | "running" | "done" | "error";

/** The CV id in the URL (#cv=<id>), so a reload or a bookmark reopens the CV editor. */
const cvIdFromHash = () => /^#cv=([0-9a-f]{32})$/.exec(window.location.hash)?.[1] ?? null;
const setCvHash = (id: string | null) =>
  history.replaceState(null, "", id ? `#cv=${id}` : window.location.pathname + window.location.search);

export default function App() {
  // Every page load starts with a fresh random test resume + job description.
  const [initial] = useState(randomSample);
  const [mode, setMode] = useState<ResumeMode>("paste");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState(initial.resume);
  const [jobText, setJobText] = useState(initial.job);

  const [phase, setPhase] = useState<Phase>("input");
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ report: OptimizationReport; markdown: string; cvId: string | null } | null>(null);
  const [missingConfig, setMissingConfig] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);
  const [savedCvId, setSavedCvId] = useState<string | null>(cvIdFromHash);

  useEffect(() => {
    checkHealth().then(setMissingConfig);
  }, []);

  const run = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("running");
    setSteps([]);
    setError(null);
    setResult(null);
    setStartedAt(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      await optimize(
        { jobText, resumeText, resumeFile: mode === "upload" ? file : null },
        (e) => {
          if (e.event === "step") setSteps((s) => [...s, { node: e.node, label: e.label, at: Date.now() }]);
          else if (e.event === "result") {
            setResult({ report: e.report, markdown: e.markdown, cvId: e.cv_id });
            setCvHash(e.cv_id);
          }
          else throw new Error(e.message);
        },
        ctrl.signal,
      );
      setPhase("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const reset = () => {
    abort.current?.abort();
    setCvHash(null);
    setSavedCvId(null);
    setPhase("input");
    setSteps([]);
    setResult(null);
    setError(null);
  };

  const goHome = () => {
    reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sample = () => {
    const s = randomSample();
    setMode("paste");
    setFile(null);
    setResumeText(s.resume);
    setJobText(s.job);
  };

  const showInputs = phase === "input" || phase === "error";

  // Reopened from a #cv=<id> link (e.g. after a reload): go straight to the CV editor.
  if (savedCvId && phase === "input") {
    return (
      <div className="relative">
        <Header onHome={goHome} />
        <main className="relative mx-auto max-w-6xl space-y-5 px-5 pt-8 pb-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Your tailored CV</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Describe any change in plain words and the agent rewrites the CV for you.
              </p>
            </div>
            <Button size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" />
              New optimization
            </Button>
          </div>
          <CVStudio cvId={savedCvId} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] text-zinc-900 dark:text-white" />
      <Header onHome={goHome} />

      <main className="relative mx-auto max-w-6xl space-y-6 px-5 pt-10 pb-20">
        {showInputs && phase === "input" && <Hero />}

        {missingConfig.length > 0 && (
          <Card className="flex gap-3 border-amber-300/70 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              The server is missing <code className="font-mono">{missingConfig.join(", ")}</code>. Add it to{" "}
              <code className="font-mono">.env</code> and restart the server.
            </p>
          </Card>
        )}

        {(phase === "running" || phase === "done" || phase === "error") && (
          <AgentProgress steps={steps} running={phase === "running"} error={error} startedAt={startedAt} />
        )}

        {showInputs ? (
          <InputPanel
            mode={mode}
            setMode={setMode}
            file={file}
            setFile={setFile}
            resumeText={resumeText}
            setResumeText={setResumeText}
            jobText={jobText}
            setJobText={setJobText}
            onSample={sample}
            onSubmit={run}
            busy={false}
          />
        ) : (
          <InputSummary
            resumeLabel={mode === "upload" && file ? file.name : `${resumeText.length.toLocaleString()} chars pasted`}
            jobChars={jobText.length}
            running={phase === "running"}
            onEdit={reset}
            onRerun={run}
          />
        )}

        {result && phase === "done" && <Results report={result.report} markdown={result.markdown} cvId={result.cvId} />}
      </main>

      <footer className="border-t border-zinc-200/70 py-6 text-center text-xs text-zinc-500 dark:border-white/10">
        Scores are computed in code, and every suggestion is checked against your resume before you see it.
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <div className="animate-fade-up mx-auto max-w-2xl pb-4 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
        <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
        Evidence-based · no fabrication
      </span>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Tailor your resume to{" "}
        <span className="bg-gradient-to-r from-brand-500 to-fuchsia-500 bg-clip-text text-transparent">
          any job
        </span>
      </h1>
      <p className="mt-4 text-lg text-balance text-zinc-600 dark:text-zinc-400">
        Score your fit, see every requirement matched with quoted evidence, and get rewrites that stay honest.
      </p>
    </div>
  );
}

function InputSummary({
  resumeLabel,
  jobChars,
  running,
  onEdit,
  onRerun,
}: {
  resumeLabel: string;
  jobChars: number;
  running: boolean;
  onEdit: () => void;
  onRerun: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-zinc-400" />
          <span className="truncate">{resumeLabel}</span>
        </span>
        <span>Job description · {jobChars.toLocaleString()} chars</span>
      </div>
      <div className="flex gap-2">
        {!running && (
          <Button size="sm" variant="ghost" onClick={onRerun}>
            <RotateCcw className="size-3.5" />
            Run again
          </Button>
        )}
        <Button size="sm" onClick={onEdit}>
          <PencilLine className="size-3.5" />
          {running ? "Cancel" : "Edit inputs"}
        </Button>
      </div>
    </Card>
  );
}
