import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/command/assignments")({
  head: () => ({
    meta: [
      { title: "Officer Assignments · MARISENTINEL" },
      { name: "description", content: "Assign field officers to confirmed incidents and monitor acceptance, deadlines and mission progress." },
      { property: "og:title", content: "Officer Assignments · MARISENTINEL" },
      { property: "og:description", content: "Assign field officers to confirmed incidents and monitor acceptance, deadlines and mission progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Officer Assignments" subtitle="Assign field officers to confirmed incidents and monitor acceptance, deadlines and mission progress." />
      <Workspace view="assignments" />
    </AppShell>
  ),
});
