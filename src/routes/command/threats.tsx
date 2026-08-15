import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/command/threats")({
  head: () => ({
    meta: [
      { title: "Threat Analysis · MARISENTINEL" },
      { name: "description", content: "Behaviour breakdown, scoring factors and zone-level threat concentration for flagged vessels." },
      { property: "og:title", content: "Threat Analysis · MARISENTINEL" },
      { property: "og:description", content: "Behaviour breakdown, scoring factors and zone-level threat concentration for flagged vessels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Threat Analysis" subtitle="Behaviour breakdown, scoring factors and zone-level threat concentration for flagged vessels." />
      <Workspace view="threats" />
    </AppShell>
  ),
});
