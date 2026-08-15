import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/command/twin")({
  head: () => ({
    meta: [
      { title: "Digital Twin · MARISENTINEL" },
      { name: "description", content: "Simulated digital twin of the Bay of Bengal theatre with vessel, zone and sensor state." },
      { property: "og:title", content: "Digital Twin · MARISENTINEL" },
      { property: "og:description", content: "Simulated digital twin of the Bay of Bengal theatre with vessel, zone and sensor state." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Digital Twin" subtitle="Simulated digital twin of the Bay of Bengal theatre with vessel, zone and sensor state." />
      <Workspace view="twin" />
    </AppShell>
  ),
});
