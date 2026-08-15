import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, KeyVal, Panel, RiskMeter, SectionHeader, timeAgo } from "@/components/ms/Bits";
import { MapView } from "@/components/ms/MapView";
import type { MapLayers } from "@/components/ms/MapCanvas";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/command/map")({
  head: () => ({
    meta: [
      { title: "Live Maritime Map · MARISENTINEL" },
      { name: "description", content: "Interactive Bay of Bengal surveillance map with vessel tracks, geofenced zones, incidents and layer controls." },
      { property: "og:title", content: "Live Maritime Map · MARISENTINEL" },
      { property: "og:description", content: "Track vessels and security zones across the Bay of Bengal in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <MapPage />
    </AppShell>
  ),
});

const LAYER_LIST: Array<[keyof MapLayers, string]> = [
  ["vessels", "Vessels"],
  ["zones", "Security zones"],
  ["threats", "Threat halos"],
  ["incidents", "Incidents"],
  ["officers", "Field officers"],
  ["trails", "Vessel trails"],
  ["satellite", "Satellite grid"],
  ["weather", "Weather overlay"],
];

function MapPage() {
  const s = useMsState();
  const [layers, setLayers] = useState<MapLayers>({
    vessels: true,
    zones: true,
    threats: true,
    incidents: true,
    officers: true,
    trails: true,
    satellite: false,
    weather: false,
  });
  const [focus, setFocus] = useState<string | null>(null);
  const vessel = s.vessels.find((v) => v.id === focus) ?? null;

  return (
    <>
      <SectionHeader
        title="Live maritime surveillance"
        subtitle="Click any vessel marker to inspect its track, behaviours and threat score."
        actions={<Badge tone="primary">{s.vessels.length} contacts</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <Panel title="Map layers" className="xl:order-2">
          <div className="space-y-2">
            {LAYER_LIST.map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[oklch(0.72_0.13_205)]"
                  checked={!!layers[key]}
                  onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Legend</p>
            <div className="mt-2 space-y-1.5 text-xs">
              {[
                ["#5ce0c0", "Low risk (0-40)"],
                ["#f0b23c", "Elevated (41-60)"],
                ["#f0743c", "High (61-80)"],
                ["#f0466a", "Critical (81-100)"],
              ].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {vessel ? (
            <div className="mt-4 border-t border-border/60 pt-3">
              <p className="text-sm font-semibold">{vessel.name}</p>
              <div className="mt-2">
                <RiskMeter score={vessel.risk} />
              </div>
              <div className="mt-2">
                <KeyVal k="MMSI" v={vessel.mmsi} />
                <KeyVal k="Type" v={vessel.type} />
                <KeyVal k="Flag" v={vessel.flag} />
                <KeyVal k="Speed" v={`${vessel.speed} kt`} />
                <KeyVal k="Course" v={`${vessel.course}°`} />
                <KeyVal k="AIS" v={vessel.ais} />
                <KeyVal k="Destination" v={vessel.destination} />
                <KeyVal k="Updated" v={timeAgo(vessel.lastUpdate)} />
              </div>
              {vessel.behaviours.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vessel.behaviours.map((b) => (
                    <Badge key={b} tone="warn">
                      {b}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel className="xl:col-span-3" bodyClassName="p-0">
          <MapView
            height="h-[calc(100vh-15rem)]"
            vessels={s.vessels}
            zones={s.zones}
            incidents={s.incidents.filter((i) => i.status !== "Closed")}
            officers={s.users.filter((u) => u.role === "field")}
            layers={layers}
            focusVesselId={focus}
            routeLine={vessel ? vessel.trail : null}
            onVesselClick={setFocus}
          />
        </Panel>
      </div>
    </>
  );
}
