import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  History,
  Loader2,
  Sparkles,
  Undo2,
  Wand2,
} from "lucide-react";
import { cvUrls, editCV, getCV, undoCV } from "../api";
import type { CVState, TailoredCV } from "../types";
import { Button, Card, SectionTitle, cn } from "./ui";

const SUGGESTIONS = [
  "Shorten the summary to two sentences",
  "Make every bullet start with a strong action verb",
  "Put the most job-relevant skills first and drop generic ones",
  "Add my LinkedIn: linkedin.com/in/your-handle",
];

export function CVStudio({ cvId }: { cvId: string }) {
  const [state, setState] = useState<CVState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"edit" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const urls = cvUrls(cvId);

  useEffect(() => {
    getCV(cvId).then(setState, (e) => setError(String(e.message ?? e)));
    return () => abort.current?.abort();
  }, [cvId]);

  const apply = async (instruction = prompt) => {
    if (!instruction.trim() || busy) return;
    abort.current = new AbortController();
    setBusy("edit");
    setError(null);
    try {
      const next = await editCV(cvId, instruction.trim(), abort.current.signal);
      setState(next);
      setPrompt("");
      setFlash((f) => f + 1);
    } catch (e) {
      if (!abort.current.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    setBusy("undo");
    setError(null);
    try {
      setState(await undoCV(cvId));
      setFlash((f) => f + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!state)
    return (
      <Card className="grid place-items-center p-16 text-sm text-zinc-500">
        {error ?? <Loader2 className="size-5 animate-spin" />}
      </Card>
    );

  const versions = state.history.length;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Version {versions} · built from your resume with the approved rewrites applied
          </p>
          <div className="flex gap-2">
            <a href={urls.view} target="_blank" rel="noreferrer">
              <Button size="sm">
                <ExternalLink className="size-3.5" />
                View online
              </Button>
            </a>
            <a href={urls.pdf} download>
              <Button size="sm" variant="primary">
                <Download className="size-3.5" />
                Download PDF
              </Button>
            </a>
          </div>
        </div>
        <div className={cn("relative transition-opacity", busy && "opacity-60")}>
          <CVSheet key={flash} cv={state.cv} />
          {busy === "edit" && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
                <Loader2 className="size-4 animate-spin" />
                Applying your change…
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-32">
        <Card className="p-5">
          <SectionTitle icon={<Wand2 className="size-4" />}>Change it with a prompt</SectionTitle>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) apply();
            }}
            rows={4}
            maxLength={2000}
            disabled={busy !== null}
            placeholder="e.g. Make the summary more focused on LLM work, or add my AWS Solutions Architect certification (2024)"
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-zinc-950/50"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-400">Ctrl + Enter to apply</span>
            <Button variant="primary" size="sm" onClick={() => apply()} disabled={!prompt.trim() || busy !== null}>
              {busy === "edit" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Apply change
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={busy !== null}
                onClick={() => setPrompt(s)}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-left text-xs text-zinc-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-white/10 dark:text-zinc-400 dark:hover:text-brand-300"
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          {state.change_summary && !error && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              {state.change_summary}
            </p>
          )}
          {!!state.warnings?.length && (
            <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Not found in your original resume: <b>{state.warnings.join(", ")}</b>. Keep them only if they're
                true, or undo.
              </span>
            </p>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            icon={<History className="size-4" />}
            action={
              <Button size="sm" variant="ghost" onClick={undo} disabled={versions < 2 || busy !== null}>
                {busy === "undo" ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                Undo
              </Button>
            }
          >
            History
          </SectionTitle>
          <ol className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {[...state.history].reverse().map((h, i) => (
              <li key={h.at} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    i === 0 ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-600",
                  )}
                />
                <span className={cn("min-w-0 break-words", i > 0 && "text-zinc-500 dark:text-zinc-400")}>
                  <span className="mr-1.5 text-xs tabular-nums text-zinc-400">v{versions - i}</span>
                  {h.note}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

/** Always rendered on white paper, like the PDF, regardless of the app theme. */
function CVSheet({ cv }: { cv: TailoredCV }) {
  const lists: [string, string[]][] = [
    ["Projects", cv.projects],
    ["Education", cv.education],
    ["Certifications", cv.certifications],
  ];
  return (
    <article className="animate-fade-up rounded-xl bg-white px-6 py-8 text-[13.5px] leading-relaxed text-zinc-900 shadow-xl ring-1 shadow-zinc-900/10 ring-zinc-200 sm:px-12 sm:py-12 dark:ring-white/10">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">{cv.name}</h2>
        {cv.headline && <p className="mt-1 text-[15px] text-brand-600">{cv.headline}</p>}
        {cv.contact.length > 0 && <p className="mt-2 text-xs text-zinc-500">{cv.contact.join("  ·  ")}</p>}
      </header>
      {cv.summary && (
        <Section title="Summary">
          <p>{cv.summary}</p>
        </Section>
      )}
      {cv.skills.length > 0 && (
        <Section title="Skills">
          <p>{cv.skills.join(", ")}</p>
        </Section>
      )}
      {cv.experience.length > 0 && (
        <Section title="Experience">
          <div className="space-y-3.5">
            {cv.experience.map((r) => (
              <div key={`${r.title}-${r.company}-${r.dates}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p>
                    <span className="font-semibold">{r.title}</span>
                    <span className="text-zinc-400"> · </span>
                    {r.company}
                  </p>
                  {r.dates && <p className="text-xs whitespace-nowrap text-zinc-500">{r.dates}</p>}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 marker:text-zinc-400">
                  {r.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
      {lists.map(
        ([title, items]) =>
          items.length > 0 && (
            <Section key={title} title={title}>
              <ul className="list-disc space-y-0.5 pl-5 marker:text-zinc-400">
                {items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Section>
          ),
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 border-b border-zinc-200 pb-1 text-xs font-semibold tracking-[0.12em] text-brand-600 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
