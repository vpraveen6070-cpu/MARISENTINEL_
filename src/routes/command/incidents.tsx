import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/command/incidents")({
  head: () => ({
    meta: [
      { title: "Incident Management · MARISENTINEL" },
      { name: "description", content: "Track confirmed maritime threats through investigation, assignment, field response and closure." },
      { property: "og:title", content: "Incident Management · MARISENTINEL" },
      { property: "og:description", content: "Track confirmed maritime threats through investigation, assignment, field response and closure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Incident Management" subtitle="Track confirmed maritime threats through investigation, assignment, field response and closure." />
      <Workspace view="incidents" />
    </AppShell>
  ),
});
