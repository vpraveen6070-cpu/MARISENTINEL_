import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "w-full rounded-md border border-input bg-surface/70 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60";

export const btn = {
  primary:
    "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
  ghost:
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50",
  danger:
    "inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50",
  tiny: "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent",
};

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div className={cn("glass w-full rounded-xl", wide ? "max-w-3xl" : "max-w-lg")}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="glass overflow-hidden rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">{children}</table>
      </div>
    </div>
  );
}

export const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
export const td = "px-4 py-3 align-middle";
export const tr = "border-t border-border/60 transition-colors hover:bg-accent/40";
