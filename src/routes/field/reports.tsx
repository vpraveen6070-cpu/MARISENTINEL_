import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/reports")({
  head: () => ({
    meta: [
      { title: "Field Reports · MARISENTINEL" },
      { name: "description", content: "Submit and review final incident reports with findings, action taken and outcome." },
      { property: "og:title", content: "Field Reports · MARISENTINEL" },
      { property: "og:description", content: "Submit and review final incident reports with findings, action taken and outcome." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Field Reports" subtitle="Submit and review final incident reports with findings, action taken and outcome." />
      <Workspace view="fieldreports" />
    </AppShell>
  ),
});
