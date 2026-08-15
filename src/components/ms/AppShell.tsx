import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Anchor,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Pause,
  Play,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { store, useMsState } from "@/lib/ms/store";
import type { Role } from "@/lib/ms/types";
import { HOME, NAV, ROLE_LABEL } from "./nav";
import { Badge, fmtTime, statusTone, timeAgo } from "./Bits";
import { cn } from "@/lib/utils";

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
        <Anchor className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-bold tracking-[0.16em] text-foreground">MARISENTINEL</span>
        {!compact ? (
          <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Autonomous Maritime Intelligence
          </span>
        ) : null}
      </span>
    </div>
  );
}

function LiveIndicator() {
  const { simRunning, tick } = useMsState();
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5">
      <span className={cn("h-2 w-2 rounded-full", simRunning ? "bg-ok ms-live-dot" : "bg-muted-foreground")} />
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {simRunning ? "Live monitoring" : "Simulation paused"}
      </span>
      <button
        type="button"
        onClick={() => store.toggleSim()}
        aria-label={simRunning ? "Pause simulation" : "Resume simulation"}
        className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {simRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className="mono-num hidden text-[10px] text-muted-foreground sm:inline">#{tick}</span>
    </div>
  );
}

function NotificationBell({ role }: { role: Role }) {
  const s = useMsState();
  const [open, setOpen] = useState(false);
  const mine = s.notifications.filter((n) => n.audience === role || n.audience === "all");
  const unread = mine.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-md border border-border bg-surface/70 p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="mono-num absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(22rem,90vw)] overflow-y-auto rounded-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notifications</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => store.markAllRead(role)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Mark all read">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => store.clearNotifications(role)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear notifications">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {mine.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No notifications.</p>
            ) : (
              mine.slice(0, 25).map((n) => (
                <div key={n.id} className={cn("border-b border-border/50 px-3 py-2.5 last:border-0", !n.read && "bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={statusTone(n.severity)}>{n.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(n.ts)}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <div className="mt-1.5 flex gap-3">
                    {n.link ? (
                      <Link to={n.link} onClick={() => { store.markNotificationRead(n.id); setOpen(false); }} className="text-[11px] font-medium text-primary hover:underline">
                        Open
                      </Link>
                    ) : null}
                    {!n.read ? (
                      <button type="button" onClick={() => store.markNotificationRead(n.id)} className="text-[11px] text-muted-foreground hover:text-foreground">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const s = useMsState();
  const navigate = useNavigate();
  const mounted = useMounted();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ms_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("ms_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    store.hydrate();
  }, []);

  useEffect(() => {
    if (!mounted || !s.hydrated) return;
    if (!s.session) {
      navigate({ to: "/login" });
    } else if (s.session.role !== role) {
      navigate({ to: HOME[s.session.role] });
    }
  }, [mounted, s.hydrated, s.session, role, navigate, pathname]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (!mounted || !s.hydrated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Initialising platform…</p>
      </div>
    );
  }

  if (!s.session || s.session.role !== role) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="glass max-w-sm rounded-lg p-6">
          <ShieldAlert className="mx-auto h-7 w-7 text-warn" />
          <h1 className="mt-3 text-lg font-semibold">Unauthorized area</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This module is restricted to {ROLE_LABEL[role]} accounts. Redirecting…
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  const items = NAV[role];

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 shrink-0 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300",
          navOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          "lg:static lg:translate-x-0",
          sidebarCollapsed ? "lg:w-0 lg:overflow-hidden lg:border-r-0 lg:p-0 lg:opacity-0 pointer-events-none" : "lg:w-64 lg:opacity-100",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link to={HOME[role]} aria-label="MARISENTINEL home">
            <Brand />
          </Link>
          <div className="flex items-center gap-1">
            {/* Desktop hide arrow button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-surface/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
              title="Hide sidebar"
              aria-label="Hide sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="rounded p-1 text-muted-foreground lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          <Badge tone="primary">{ROLE_LABEL[role]}</Badge>
          <p className="mt-2 truncate text-xs text-muted-foreground">{s.session.name}</p>
        </div>
        <nav className="space-y-0.5 overflow-y-auto px-2 pb-4" style={{ maxHeight: "calc(100vh - 12rem)" }}>
          {items.map((it) => {
            const active = pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground ring-1 ring-primary/25"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              store.logout();
              navigate({ to: "/login" });
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </nav>
      </aside>

      {navOpen ? (
        <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-background/70 lg:hidden" onClick={() => setNavOpen(false)} />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-5">
          {/* Mobile hamburger menu */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="rounded-md border border-border p-2 text-muted-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Desktop unhide/toggle arrow button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden items-center justify-center rounded-md border border-border bg-surface/70 p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground lg:flex"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-primary" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Bay of Bengal · Coastal Security Grid
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LiveIndicator />
            <NotificationBell role={role} />
            <div className="hidden items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 py-1.5 sm:flex">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {s.session.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-xs">
                <span className="block font-medium leading-tight">{s.session.name}</span>
                <span className="block text-[10px] leading-tight text-muted-foreground">
                  since {fmtTime(s.session.loginAt)}
                </span>
              </span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
