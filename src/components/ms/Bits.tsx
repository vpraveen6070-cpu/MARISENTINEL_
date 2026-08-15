import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { riskBand } from "@/lib/ms/threat";

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger" | "critical" | "primary";
  icon?: ReactNode;
}) {
  const toneRing: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    critical: "text-critical",
  };
  return (
    <div className="glass relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("mono-num mt-2 text-2xl font-semibold sm:text-3xl", toneRing[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  ok: "bg-ok/15 text-ok border-ok/40",
  info: "bg-info/15 text-info border-info/40",
  warn: "bg-warn/15 text-warn border-warn/40",
  danger: "bg-danger/18 text-danger border-danger/45",
  critical: "bg-critical/20 text-critical border-critical/50",
  primary: "bg-primary/15 text-primary border-primary/40",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof badgeTones {
  const s = status.toLowerCase();
  if (["critical", "high risk", "rejected", "failed"].includes(s)) return "critical";
  if (["high", "restricted", "new", "open", "awaiting review"].includes(s)) return "danger";
  if (["medium", "monitoring", "investigating", "in progress", "elevated", "assigned", "degraded", "on-mission"].includes(s))
    return "warn";
  if (["low", "normal", "closed", "resolved", "false alarm", "off-duty", "disconnected"].includes(s)) return "neutral";
  if (["active", "connected", "available", "completed", "confirmed", "accepted"].includes(s)) return "ok";
  return "info";
}

export function RiskMeter({ score, compact = false }: { score: number; compact?: boolean }) {
  const band = riskBand(score);
  const tone = band.tone as keyof typeof badgeTones;
  const barTone: Record<string, string> = {
    ok: "bg-ok",
    info: "bg-info",
    warn: "bg-warn",
    danger: "bg-danger",
    critical: "bg-critical",
  };
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="mono-num text-sm font-semibold">{score}</span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", barTone[band.tone])} style={{ width: `${score}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="mono-num text-3xl font-semibold">{score}</span>
        <Badge tone={tone}>{band.label}</Badge>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", barTone[band.tone])} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Threat risk score 0–100 (rule-based engine)</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
  className,
  bodyClassName,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("glass rounded-lg border border-border bg-card shadow-sm", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KeyVal({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="mono-num text-right text-xs font-medium">{v}</span>
    </div>
  );
}

export function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (Math.abs(m) < 1) return "just now";
  if (m < 0) return `in ${Math.abs(m) < 60 ? `${Math.abs(m)} min` : `${Math.round(Math.abs(m) / 60)} h`}`;
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function fmtTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Timeline({ entries }: { entries: Array<{ ts: string; actor: string; status: string; note: string }> }) {
  if (!entries.length) return <Empty title="No timeline entries yet" />;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((e, i) => (
        <li key={`${e.ts}-${i}`} className="relative">
          <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px] shadow-primary/20" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(e.status)}>{e.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {fmtTime(e.ts)} · {e.actor}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{e.note}</p>
        </li>
      ))}
    </ol>
  );
}
