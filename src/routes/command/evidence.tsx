import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/command/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence Review · MARISENTINEL" },
      { name: "description", content: "Review photographs, observations and sensor data submitted by field officers on active incidents." },
      { property: "og:title", content: "Evidence Review · MARISENTINEL" },
      { property: "og:description", content: "Review photographs, observations and sensor data submitted by field officers on active incidents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Evidence Review" subtitle="Review photographs, observations and sensor data submitted by field officers on active incidents." />
      <Workspace view="evidence" />
    </AppShell>
  ),
});
