import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/evidence")({
  head: () => ({
    meta: [
      { title: "Submit Evidence · MARISENTINEL" },
      { name: "description", content: "Attach photographs, video, documents, observations and sensor data to your active incident." },
      { property: "og:title", content: "Submit Evidence · MARISENTINEL" },
      { property: "og:description", content: "Attach photographs, video, documents, observations and sensor data to your active incident." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Submit Evidence" subtitle="Attach photographs, video, documents, observations and sensor data to your active incident." />
      <Workspace view="fieldevidence" />
    </AppShell>
  ),
});
