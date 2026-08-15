import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Radio, ShieldAlert, Users } from "lucide-react";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, Metric, Panel, SectionHeader, fmtTime, statusTone, timeAgo } from "@/components/ms/Bits";
import { MapView } from "@/components/ms/MapView";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administrator Console · MARISENTINEL" },
      { name: "description", content: "Platform configuration overview: users, security zones, data sources, system health and audit activity." },
      { property: "og:title", content: "Administrator Console · MARISENTINEL" },
      { property: "og:description", content: "Configure and audit the maritime intelligence platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <AdminHome />
    </AppShell>
  ),
});

function AdminHome() {
  const s = useMsState();
  const activeIncidents = s.incidents.filter((i) => i.status !== "Closed");
  const critical = s.alerts.filter((a) => a.severity === "Critical" && a.status !== "Resolved" && a.status !== "False Alarm");
  const connected = s.sources.filter((x) => x.status === "connected").length;
  const health = Math.round((connected / Math.max(1, s.sources.length)) * 100);

  return (
    <>
      <SectionHeader
        title="Administrator overview"
        subtitle="Platform configuration, identity, data sources and audit posture."
        actions={<Badge tone={health === 100 ? "ok" : "warn"}>System health {health}%</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total users" value={s.users.length} icon={<Users className="h-4 w-4" />} hint={`${s.users.filter((u) => u.status === "active").length} active`} />
        <Metric label="Active users" value={s.users.filter((u) => u.status === "active").length} tone="ok" hint="Signed-in capable accounts" />
        <Metric label="Active security zones" value={s.zones.filter((z) => z.status === "active").length} tone="primary" hint={`${s.zones.length} configured`} />
        <Metric label="Connected data sources" value={`${connected}/${s.sources.length}`} icon={<Radio className="h-4 w-4" />} tone={connected === s.sources.length ? "ok" : "warn"} />
        <Metric label="Active incidents" value={activeIncidents.length} tone="warn" hint={`${s.incidents.length} total`} />
        <Metric label="Critical alerts" value={critical.length} tone="critical" icon={<ShieldAlert className="h-4 w-4" />} />
        <Metric label="Tracked vessels" value={s.vessels.length} hint={`${s.vessels.filter((v) => v.risk >= 41).length} flagged`} />
        <Metric label="Audit events" value={s.audit.length} icon={<Activity className="h-4 w-4" />} hint="Last 400 retained" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Security zone coverage" className="xl:col-span-2" bodyClassName="p-0">
          <MapView height="h-[380px]" zones={s.zones} vessels={s.vessels} incidents={activeIncidents} officers={[]} layers={{ officers: false }} />
        </Panel>
        <Panel title="Recent activity" bodyClassName="p-0">
          <div className="max-h-[380px] overflow-y-auto">
            {s.audit.length === 0 ? (
              <Empty title="No audit records" />
            ) : (
              s.audit.slice(0, 14).map((l) => (
                <div key={l.id} className="border-b border-border/50 px-4 py-2.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={l.status === "success" ? "ok" : "critical"}>{l.module}</Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(l.ts)}</span>
                  </div>
                  <p className="mt-1 text-xs">{l.action}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.user} · {fmtTime(l.ts)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {s.sources.map((src) => (
          <Panel key={src.id} title={src.kind}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{src.name}</p>
              <Badge tone={statusTone(src.status)}>{src.status}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Last sync {timeAgo(src.lastSync)}</p>
            <Link to="/admin/sources" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
              Manage source →
            </Link>
          </Panel>
        ))}
      </div>
    </>
  );
}
