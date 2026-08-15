import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · MARISENTINEL" },
      { name: "description", content: "Role-based alert and mission notifications with read state and deep links." },
      { property: "og:title", content: "Notifications · MARISENTINEL" },
      { property: "og:description", content: "Role-based alert and mission notifications with read state and deep links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role={useMsState().session?.role ?? "command"}>
      <SectionHeader title="Notifications" subtitle="Role-based alert and mission notifications with read state and deep links." />
      <Workspace view="notifications" />
    </AppShell>
  ),
});
