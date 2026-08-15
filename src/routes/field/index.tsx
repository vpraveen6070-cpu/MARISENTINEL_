import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/")({
  head: () => ({
    meta: [
      { title: "Field Officer Dashboard · MARISENTINEL" },
      { name: "description", content: "Your assigned missions, current status, deadlines and quick reporting actions." },
      { property: "og:title", content: "Field Officer Dashboard · MARISENTINEL" },
      { property: "og:description", content: "Your assigned missions, current status, deadlines and quick reporting actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Field Officer Dashboard" subtitle="Your assigned missions, current status, deadlines and quick reporting actions." />
      <Workspace view="fieldhome" />
    </AppShell>
  ),
});
