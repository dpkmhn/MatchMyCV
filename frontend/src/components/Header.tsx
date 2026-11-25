import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";

type Status = "checking" | "live" | "setup" | "offline";

const STATUS: Record<Status, { label: string; title: string; dot: string; pill: string; pulse: boolean }> = {
  checking: {
    label: "Connecting",
    title: "Checking the server…",
    dot: "bg-zinc-400",
    pill: "border-zinc-200 text-zinc-500 dark:border-white/10 dark:text-zinc-400",
    pulse: true,
  },
  live: {
    label: "Live",
    title: "Server and AI model are ready",
    dot: "bg-emerald-500",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    pulse: true,
  },
  setup: {
    label: "Setup needed",
    title: "The server is up but GROQ_API_KEY is missing",
    dot: "bg-amber-500",
    pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: false,
  },
  offline: {
    label: "Offline",
    title: "Can't reach the server",
    dot: "bg-rose-500",
    pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    pulse: false,
  },
};

/** Polls /health so the header shows whether the agent can run right now. */
function LiveStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/health", { cache: "no-store" });
        const data = (await res.json()) as { missing?: string[] };
        if (alive) setStatus(!res.ok ? "offline" : data.missing?.length ? "setup" : "live");
      } catch {
        if (alive) setStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 15000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("offline", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("offline", onFocus);
    };
  }, []);

  const s = STATUS[status];
  return (
    <span
      role="status"
      aria-live="polite"
      title={s.title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.pill}`}
    >
      <span className="relative flex size-1.5">
        {s.pulse && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${s.dot}`} />}
        <span className={`relative inline-flex size-1.5 rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}

export function Header() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-md shadow-brand-600/30">
            <Sparkles className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">MatchMyCV</span>
          <LiveStatus />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Dark mode"
          title={dark ? "Dark mode on" : "Dark mode off"}
          onClick={() => setDark((d) => !d)}
          className="relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-100 p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-white/10 dark:bg-brand-600/40"
        >
          <Sun className="absolute left-1.5 size-3.5 text-amber-500 opacity-0 transition-opacity dark:opacity-60" />
          <Moon className="absolute right-1.5 size-3.5 text-zinc-400 transition-opacity dark:opacity-0" />
          <span
            className={`relative grid size-6 place-items-center rounded-full bg-white shadow-sm ring-1 ring-zinc-900/5 transition-transform duration-200 ease-out dark:bg-zinc-900 ${
              dark ? "translate-x-6" : "translate-x-0"
            }`}
          >
            {dark ? <Moon className="size-3.5 text-brand-300" /> : <Sun className="size-3.5 text-amber-500" />}
          </span>
        </button>
      </div>
    </header>
  );
}
