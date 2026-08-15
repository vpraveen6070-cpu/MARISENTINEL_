import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/assignments")({
  head: () => ({
    meta: [
      { title: "My Assignments · MARISENTINEL" },
      { name: "description", content: "Accept or decline assigned incidents and review mission briefs and deadlines." },
      { property: "og:title", content: "My Assignments · MARISENTINEL" },
      { property: "og:description", content: "Accept or decline assigned incidents and review mission briefs and deadlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="My Assignments" subtitle="Accept or decline assigned incidents and review mission briefs and deadlines." />
      <Workspace view="fieldassign" />
    </AppShell>
  ),
});
