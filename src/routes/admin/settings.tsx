import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, KeyVal, Panel, SectionHeader } from "@/components/ms/Bits";
import { btn } from "@/components/ms/Form";
import { store, useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings · MARISENTINEL Admin" },
      { name: "description", content: "Operational region, simulation control and demo data management for the maritime intelligence platform." },
      { property: "og:title", content: "Platform Settings · MARISENTINEL" },
      { property: "og:description", content: "Control the live simulation and reset demonstration data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <SettingsPage />
    </AppShell>
  ),
});

function SettingsPage() {
  const s = useMsState();

  return (
    <>
      <SectionHeader title="Platform settings" subtitle="Region configuration, live simulation and demonstration data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Operational configuration">
          <KeyVal k="Platform" v="MARISENTINEL" />
          <KeyVal k="Operational region" v="Bay of Bengal" />
          <KeyVal k="Chart provider" v="OpenStreetMap via Leaflet" />
          <KeyVal k="Detection model" v="Rule-based scoring engine (simulated)" />
          <KeyVal k="Persistence" v="Browser local storage" />
          <KeyVal k="Roles" v="Administrator · Command Officer · Field Officer" />
        </Panel>

        <Panel title="Live simulation">
          <p className="text-sm text-muted-foreground">
            The simulation advances vessel positions, recomputes threat scores and raises new alerts every few seconds.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Badge tone={s.simRunning ? "ok" : "warn"}>{s.simRunning ? "Running" : "Paused"}</Badge>
            <span className="mono-num text-xs text-muted-foreground">{s.tick} cycles</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                store.toggleSim();
                toast.success(s.simRunning ? "Simulation paused" : "Simulation resumed");
              }}
            >
              {s.simRunning ? "Pause simulation" : "Resume simulation"}
            </button>
            <button
              type="button"
              className={btn.danger}
              onClick={() => {
                store.reset();
                toast.success("Demonstration data restored");
              }}
            >
              Reset demo data
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Resetting restores the original Bay of Bengal scenario, including users, zones, vessels and the seeded critical
            incident.
          </p>
        </Panel>
      </div>
    </>
  );
}
