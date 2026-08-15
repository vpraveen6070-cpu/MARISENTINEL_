import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";

export const Route = createFileRoute("/field/updates")({
  head: () => ({
    meta: [
      { title: "Status Updates · MARISENTINEL" },
      { name: "description", content: "Post progress updates that appear instantly on the command officer's incident timeline." },
      { property: "og:title", content: "Status Updates · MARISENTINEL" },
      { property: "og:description", content: "Post progress updates that appear instantly on the command officer's incident timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="field">
      <SectionHeader title="Status Updates" subtitle="Post progress updates that appear instantly on the command officer's incident timeline." />
      <Workspace view="fieldupdates" />
    </AppShell>
  ),
});
