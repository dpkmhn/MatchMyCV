import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white/80 shadow-sm shadow-zinc-900/[0.03] backdrop-blur",
        "dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {icon && <span className="text-brand-500 dark:text-brand-400">{icon}</span>}
        {children}
      </h3>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-sm",
        variant === "primary" &&
          "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-600/25 hover:from-brand-400 hover:to-brand-600 active:scale-[0.98]",
        variant === "secondary" &&
          "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
        variant === "ghost" &&
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100",
        className,
      )}
    />
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "brand";

const toneClass: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  warn: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  bad: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chips({ items, tone = "neutral" }: { items: string[]; tone?: Tone }) {
  if (!items.length) return <p className="text-sm text-zinc-500 dark:text-zinc-400">None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <Badge key={t} tone={tone}>
          {t}
        </Badge>
      ))}
    </div>
  );
}

export function scoreTone(v: number): Tone {
  return v >= 75 ? "good" : v >= 50 ? "warn" : "bad";
}
