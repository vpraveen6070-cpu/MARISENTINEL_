import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { SectionHeader } from "@/components/ms/Bits";
import { Workspace } from "@/components/ms/Workspace";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile · MARISENTINEL" },
      { name: "description", content: "Your account, role permissions, assigned region and recent activity." },
      { property: "og:title", content: "My Profile · MARISENTINEL" },
      { property: "og:description", content: "Your account, role permissions, assigned region and recent activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role={useMsState().session?.role ?? "command"}>
      <SectionHeader title="My Profile" subtitle="Your account, role permissions, assigned region and recent activity." />
      <Workspace view="profile" />
    </AppShell>
  ),
});
