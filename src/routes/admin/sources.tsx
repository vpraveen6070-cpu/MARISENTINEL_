import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Satellite, CloudSun, Plug, PlugZap, Activity } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, KeyVal, Panel, SectionHeader, statusTone, timeAgo } from "@/components/ms/Bits";
import { btn } from "@/components/ms/Form";
import { aisService } from "@/api/aisService";
import { satelliteService } from "@/api/satelliteService";
import { weatherService } from "@/api/weatherService";
import { store, useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/sources")({
  head: () => ({
    meta: [
      { title: "Data Sources · MARISENTINEL Admin" },
      { name: "description", content: "Connect, test and monitor AIS, satellite imagery and marine weather feeds powering the platform." },
      { property: "og:title", content: "Data Sources · MARISENTINEL" },
      { property: "og:description", content: "AIS, satellite and weather integration status for coastal surveillance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <SourcesPage />
    </AppShell>
  ),
});

const ICONS = { AIS: Radio, Satellite, Weather: CloudSun } as const;

function SourcesPage() {
  const s = useMsState();
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function test(kind: "AIS" | "Satellite" | "Weather", id: string) {
    setTesting(id);
    try {
      const res =
        kind === "AIS" ? await aisService.status() : kind === "Satellite" ? await satelliteService.status() : await weatherService.status();
      if (!res) throw new Error("No response from upstream");
      if (res.status !== "connected") throw new Error("Endpoint unreachable — feed is disconnected");
      setResults((r) => ({ ...r, [id]: `200 OK · handshake verified at ${new Date().toLocaleTimeString("en-GB")}` }));
      toast.success(`${kind} feed responded successfully`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failure";
      setResults((r) => ({ ...r, [id]: `FAILED · ${msg}` }));
      toast.error(`${kind} test failed: ${msg}`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <>
      <SectionHeader
        title="Data source management"
        subtitle="Mock responses today; each card maps to a REST service in /src/api so real credentials can be swapped in without UI changes."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {s.sources.map((src) => {
          const Icon = ICONS[src.kind];
          return (
            <Panel key={src.id} title={`${src.kind} feed`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-primary" /> {src.name}
                  </p>
                  <p className="mono-num mt-1 text-[11px] text-muted-foreground">{String(src.meta["endpoint"] ?? "—")}</p>
                </div>
                <Badge tone={statusTone(src.status)}>{src.status}</Badge>
              </div>
              <div className="mt-3">
                <KeyVal k="Last sync" v={timeAgo(src.lastSync)} />
                {Object.entries(src.meta)
                  .filter(([k]) => k !== "endpoint")
                  .map(([k, v]) => (
                    <KeyVal key={k} k={k} v={String(v)} />
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={src.status === "connected"}
                  onClick={() => {
                    store.setSourceStatus(src.id, "connected");
                    toast.success(`${src.kind} feed connected`);
                  }}
                >
                  <PlugZap className="h-3.5 w-3.5" /> Connect
                </button>
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={src.status === "disconnected"}
                  onClick={() => {
                    store.setSourceStatus(src.id, "disconnected");
                    toast.message(`${src.kind} feed disconnected`);
                  }}
                >
                  <Plug className="h-3.5 w-3.5" /> Disconnect
                </button>
                <button type="button" className={btn.ghost} disabled={testing === src.id} onClick={() => void test(src.kind, src.id)}>
                  <Activity className="h-3.5 w-3.5" /> {testing === src.id ? "Testing…" : "Test"}
                </button>
              </div>
              {results[src.id] ? (
                <p
                  className={`mono-num mt-3 rounded-md border p-2 text-[11px] ${
                    results[src.id]!.startsWith("FAILED")
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-ok/40 bg-ok/10 text-ok"
                  }`}
                >
                  {results[src.id]}
                </p>
              ) : null}
            </Panel>
          );
        })}
      </div>

      <Panel title="Current marine conditions (weather feed)" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <KeyVal k="Wind" v={`${s.weather.windKts} kt ${s.weather.windDir}`} />
          <KeyVal k="Wave height" v={`${s.weather.waveM} m`} />
          <KeyVal k="Visibility" v={`${s.weather.visibilityKm} km`} />
          <KeyVal k="Sea state" v={s.weather.seaState} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{s.weather.advisory}</p>
      </Panel>
    </>
  );
}
