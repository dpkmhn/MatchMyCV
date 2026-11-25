import { useState } from "react";
import { Briefcase, FileText, FileUp, Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { Button, Card, cn } from "./ui";

export type ResumeMode = "upload" | "paste";

interface Props {
  mode: ResumeMode;
  setMode: (m: ResumeMode) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  resumeText: string;
  setResumeText: (s: string) => void;
  jobText: string;
  setJobText: (s: string) => void;
  onSample: () => void;
  onSubmit: () => void;
  busy: boolean;
}

const MIN_JOB = 50;
const ACCEPT = ".pdf,.docx,.txt,.md";

export function InputPanel(p: Props) {
  const resumeReady = p.mode === "upload" ? !!p.file : p.resumeText.trim().length > 0;
  const jobReady = p.jobText.trim().length >= MIN_JOB;

  return (
    <form
      className="grid gap-5 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (resumeReady && jobReady && !p.busy) p.onSubmit();
      }}
    >
      <Card className="flex flex-col p-5">
        <StepHeader n={1} icon={<FileText className="size-4" />} title="Your resume" done={resumeReady}>
          <Segmented
            value={p.mode}
            onChange={p.setMode}
            options={[
              { value: "upload", label: "Upload" },
              { value: "paste", label: "Paste" },
            ]}
          />
        </StepHeader>
        {p.mode === "upload" ? (
          <Dropzone file={p.file} setFile={p.setFile} />
        ) : (
          <TextArea
            value={p.resumeText}
            onChange={p.setResumeText}
            placeholder="Paste your resume text…"
            label="Resume text"
          />
        )}
      </Card>

      <Card className="flex flex-col p-5">
        <StepHeader n={2} icon={<Briefcase className="size-4" />} title="Job description" done={jobReady} />
        <TextArea
          value={p.jobText}
          onChange={p.setJobText}
          placeholder="Paste the full job description, including the requirements…"
          label="Job description"
          hint={!jobReady && p.jobText.length > 0 ? `At least ${MIN_JOB} characters` : undefined}
        />
      </Card>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center lg:col-span-2">
        <Button type="button" variant="ghost" onClick={p.onSample} disabled={p.busy}>
          <Wand2 className="size-4" />
          New random sample
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={!resumeReady || !jobReady || p.busy}>
          {p.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {p.busy ? "Optimizing…" : "Optimize resume"}
        </Button>
      </div>
    </form>
  );
}

function StepHeader({
  n,
  icon,
  title,
  done,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full text-xs font-semibold transition-colors",
            done
              ? "bg-emerald-500 text-white"
              : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400",
          )}
        >
          {n}
        </span>
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-zinc-400">{icon}</span>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition",
            value === o.value
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  label,
  hint,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "min-h-72 flex-1 resize-y rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 font-mono text-[13px] leading-relaxed",
          "placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10",
          "dark:border-white/10 dark:bg-black/20 dark:focus:bg-black/30",
        )}
      />
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span className="text-amber-600 dark:text-amber-400">{hint}</span>
        <span className="tabular-nums">{value.length.toLocaleString()} chars</span>
      </div>
    </div>
  );
}

function Dropzone({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  const [over, setOver] = useState(false);

  if (file) {
    return (
      <div className="flex min-h-72 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-emerald-300/70 bg-emerald-50/50 p-6 dark:border-emerald-500/30 dark:bg-emerald-500/5">
        <div className="grid size-14 place-items-center rounded-2xl bg-white shadow-sm dark:bg-zinc-800">
          <FileText className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="font-medium break-all">{file.name}</p>
          <p className="text-sm text-zinc-500">
            {Math.max(1, Math.round(file.size / 1024))} KB · ready
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setFile(null)}>
          <X className="size-3.5" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) setFile(f);
      }}
      className={cn(
        "group flex min-h-72 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition",
        over
          ? "border-brand-400 bg-brand-50/60 dark:bg-brand-500/10"
          : "border-zinc-200 hover:border-brand-300 hover:bg-zinc-50 dark:border-white/10 dark:hover:border-brand-500/50 dark:hover:bg-white/[0.02]",
      )}
    >
      <input
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:scale-105 dark:bg-brand-500/10 dark:text-brand-300">
        {over ? <FileUp className="size-6" /> : <Upload className="size-6" />}
      </div>
      <div>
        <p className="font-medium">
          Drop your resume here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
        </p>
        <p className="mt-1 text-sm text-zinc-500">PDF, DOCX or TXT · up to 5 MB</p>
      </div>
    </label>
  );
}
