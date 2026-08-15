import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, KeyVal, Metric, Panel, SectionHeader, statusTone, timeAgo } from "@/components/ms/Bits";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/health")({
  head: () => ({
    meta: [
      { title: "System Health · MARISENTINEL Admin" },
      { name: "description", content: "Feed latency, detection engine cycles, storage state and service availability for the platform." },
      { property: "og:title", content: "System Health · MARISENTINEL" },
      { property: "og:description", content: "Operational health of the maritime intelligence services." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <HealthPage />
    </AppShell>
  ),
});

function HealthPage() {
  const s = useMsState();
  const connected = s.sources.filter((x) => x.status === "connected").length;
  const uptime = 99.4;

  return (
    <>
      <SectionHeader title="System health" subtitle="Service availability, feed freshness and detection engine throughput." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Platform uptime" value={`${uptime}%`} tone="ok" hint="Rolling 30 days" />
        <Metric label="Feeds online" value={`${connected}/${s.sources.length}`} tone={connected === s.sources.length ? "ok" : "warn"} />
        <Metric label="Engine cycles" value={s.tick} tone="primary" hint="Since session start" />
        <Metric label="Simulation" value={s.simRunning ? "Running" : "Paused"} tone={s.simRunning ? "ok" : "warn"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Service status">
          {[
            ["Identity & access service", "connected"],
            ["Detection engine (rule-based)", s.simRunning ? "connected" : "degraded"],
            ["Incident service", "connected"],
            ["Evidence store (local persistence)", "connected"],
            ["Notification bus", "connected"],
          ].map(([name, st]) => (
            <div key={name} className="flex items-center justify-between border-b border-border/50 py-2.5 last:border-0">
              <span className="text-sm">{name}</span>
              <Badge tone={statusTone(String(st))}>{String(st)}</Badge>
            </div>
          ))}
        </Panel>
        <Panel title="Feed freshness">
          {s.sources.map((src) => (
            <KeyVal key={src.id} k={`${src.kind} · ${src.status}`} v={timeAgo(src.lastSync)} />
          ))}
          <KeyVal k="Weather model" v={timeAgo(s.weather.updatedAt)} />
          <KeyVal k="Vessels in memory" v={s.vessels.length} />
          <KeyVal k="Audit records" v={s.audit.length} />
          <KeyVal k="Stored evidence items" v={s.evidence.length} />
        </Panel>
      </div>
    </>
  );
}
