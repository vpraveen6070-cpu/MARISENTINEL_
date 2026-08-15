import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { AnalyticsBoard } from "@/components/ms/Analytics";
import { SectionHeader } from "@/components/ms/Bits";

export const Route = createFileRoute("/command/analytics")({
  head: () => ({
    meta: [
      { title: "Operational Analytics · MARISENTINEL" },
      { name: "description", content: "Incident trends, threat distribution, response times and predictive zone risk forecasting." },
      { property: "og:title", content: "Operational Analytics · MARISENTINEL" },
      { property: "og:description", content: "Incident trends, threat distribution, response times and predictive zone risk forecasting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <SectionHeader title="Operational analytics" subtitle="Trends and predictive risk across the Bay of Bengal theatre." />
      <AnalyticsBoard />
    </AppShell>
  ),
});
