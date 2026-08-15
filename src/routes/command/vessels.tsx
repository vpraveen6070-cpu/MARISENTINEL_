import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { VesselTable } from "@/components/ms/VesselTable";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/command/vessels")({
  head: () => ({
    meta: [
      { title: "Vessel Tracking · MARISENTINEL" },
      { name: "description", content: "Search and filter tracked Bay of Bengal vessels by risk band, AIS state, flag and MMSI." },
      { property: "og:title", content: "Vessel Tracking · MARISENTINEL" },
      { property: "og:description", content: "Search and filter tracked Bay of Bengal vessels by risk band, AIS state, flag and MMSI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <Page />
    </AppShell>
  ),
});

function Page() {
  const s = useMsState();
  return (
    <>
      <SectionHeader title="Vessel tracking" subtitle="Live AIS contacts ranked by computed threat score." />
      <VesselTable vessels={s.vessels} zones={s.zones} />
    </>
  );
}
