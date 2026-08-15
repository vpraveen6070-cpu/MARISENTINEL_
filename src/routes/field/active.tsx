import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/active")({
  head: () => ({
    meta: [
      { title: "Active Incident · MARISENTINEL" },
      { name: "description", content: "Update mission status as you move en route, arrive on scene and investigate." },
      { property: "og:title", content: "Active Incident · MARISENTINEL" },
      { property: "og:description", content: "Update mission status as you move en route, arrive on scene and investigate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Active Incident" subtitle="Update mission status as you move en route, arrive on scene and investigate." />
      <Workspace view="fieldactive" />
    </AppShell>
  ),
});
