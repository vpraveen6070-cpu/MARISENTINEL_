import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Ship, Siren, Waves } from "lucide-react";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, KeyVal, Metric, Panel, RiskMeter, SectionHeader, fmtTime, statusTone, timeAgo } from "@/components/ms/Bits";
import { MapView } from "@/components/ms/MapView";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/command/")({
  head: () => ({
    meta: [
      { title: "Command Center · MARISENTINEL" },
      { name: "description", content: "Live Bay of Bengal command dashboard: active threats, vessel tracking, alerts and incident response status." },
      { property: "og:title", content: "Command Center · MARISENTINEL" },
      { property: "og:description", content: "Real-time maritime threat picture for command officers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <CommandHome />
    </AppShell>
  ),
});

function CommandHome() {
  const s = useMsState();
  const openAlerts = s.alerts.filter((a) => a.status === "New" || a.status === "Investigating");
  const critical = s.alerts.filter((a) => a.severity === "Critical" && a.status !== "Resolved" && a.status !== "False Alarm");
  const active = s.incidents.filter((i) => i.status !== "Closed");
  const officers = s.users.filter((u) => u.role === "field");
  const highRisk = s.vessels.filter((v) => v.risk >= 61).sort((a, b) => b.risk - a.risk);

  return (
    <>
      <SectionHeader
        title="Maritime command center"
        subtitle="Bay of Bengal · live surveillance picture"
        actions={<Badge tone={s.simRunning ? "ok" : "warn"}>{s.simRunning ? "Live feed active" : "Feed paused"}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vessels tracked" value={s.vessels.length} icon={<Ship className="h-4 w-4" />} hint={`${s.vessels.filter((v) => v.ais === "lost").length} AIS lost`} />
        <Metric label="Open alerts" value={openAlerts.length} tone="warn" icon={<AlertTriangle className="h-4 w-4" />} />
        <Metric label="Critical threats" value={critical.length} tone="critical" icon={<Siren className="h-4 w-4" />} />
        <Metric label="Active incidents" value={active.length} tone="primary" hint={`${active.filter((i) => i.assignedTo).length} assigned`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Live maritime picture" className="xl:col-span-2" bodyClassName="p-0"
          actions={<Link to="/command/map" className="text-xs text-primary hover:underline">Open full map</Link>}>
          <MapView
            height="h-[420px]"
            vessels={s.vessels}
            zones={s.zones}
            incidents={active}
            officers={officers}
            layers={{ officers: true, incidents: true, trails: true }}
          />
        </Panel>

        <div className="space-y-4">
          <Panel title="Sea state" >
            <KeyVal k="Wind" v={`${s.weather.windKts} kt ${s.weather.windDir}`} />
            <KeyVal k="Wave height" v={`${s.weather.waveM} m`} />
            <KeyVal k="Visibility" v={`${s.weather.visibilityKm} km`} />
            <KeyVal k="Sea state" v={s.weather.seaState} />
            <p className="mt-2 rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">{s.weather.advisory}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Updated {timeAgo(s.weather.updatedAt)}</p>
          </Panel>

          <Panel title="Highest risk vessels" bodyClassName="p-0">
            <div className="max-h-[240px] overflow-y-auto">
              {highRisk.length === 0 ? (
                <Empty title="No elevated risk vessels" hint="All tracked traffic is behaving normally." />
              ) : (
                highRisk.slice(0, 6).map((v) => (
                  <div key={v.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{v.name}</span>
                      <Badge tone={v.risk > 80 ? "critical" : "warn"}>{v.risk}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{v.behaviours.slice(0, 2).join(" · ") || "Nominal"}</p>
                    <div className="mt-2">
                      <RiskMeter score={v.risk} compact />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Latest alerts" bodyClassName="p-0"
          actions={<Link to="/command/alerts" className="text-xs text-primary hover:underline">Manage alerts</Link>}>
          <div className="max-h-[320px] overflow-y-auto">
            {s.alerts.length === 0 ? (
              <Empty title="No alerts raised yet" />
            ) : (
              s.alerts.slice(0, 8).map((a) => (
                <div key={a.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(a.severity)}>{a.severity}</Badge>
                    <span className="text-sm font-medium">{a.vesselName}</span>
                    <span className="mono-num ml-auto text-[11px] text-muted-foreground">{fmtTime(a.ts)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.threatType} · {a.zoneName}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Field officer readiness" bodyClassName="p-0">
          <div className="max-h-[320px] overflow-y-auto">
            {officers.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="mono-num text-[11px] text-muted-foreground">
                    {(o.lat ?? 0).toFixed(2)}°N {(o.lng ?? 0).toFixed(2)}°E · {o.region}
                  </p>
                </div>
                <Badge tone={o.availability === "available" ? "ok" : o.availability === "on-mission" ? "warn" : "neutral"}>
                  {o.availability ?? "unknown"}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Sea traffic advisory" className="mt-4">
        <p className="text-sm text-muted-foreground">
          <Waves className="mr-1.5 inline h-4 w-4 text-primary" />
          Detection engine is running rule-based scoring across {s.vessels.length} vessels and {s.zones.length} geofenced
          zones. Confirm an alert to escalate it into a tracked incident and assign a field officer.
        </p>
      </Panel>
    </>
  );
}
