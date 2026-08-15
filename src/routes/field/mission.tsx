import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/mission")({
  head: () => ({
    meta: [
      { title: "Mission Map · MARISENTINEL" },
      { name: "description", content: "Navigate to the incident location with your position, target vessel and surrounding zones." },
      { property: "og:title", content: "Mission Map · MARISENTINEL" },
      { property: "og:description", content: "Navigate to the incident location with your position, target vessel and surrounding zones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Mission Map" subtitle="Navigate to the incident location with your position, target vessel and surrounding zones." />
      <Workspace view="fieldmap" />
    </AppShell>
  ),
});
