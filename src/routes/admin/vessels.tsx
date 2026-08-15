import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { VesselTable } from "@/components/ms/VesselTable";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/vessels")({
  head: () => ({
    meta: [
      { title: "Vessel Data · MARISENTINEL Admin" },
      { name: "description", content: "Full AIS vessel register with position, speed, flag, zone and computed threat score." },
      { property: "og:title", content: "Vessel Data · MARISENTINEL" },
      { property: "og:description", content: "Inspect the raw vessel dataset feeding the detection engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <VesselsAdmin />
    </AppShell>
  ),
});

function VesselsAdmin() {
  const s = useMsState();
  return (
    <>
      <SectionHeader title="Vessel data register" subtitle={`${s.vessels.length} vessels ingested from the AIS feed, updating live.`} />
      <VesselTable vessels={s.vessels} zones={s.zones} />
    </>
  );
}
