import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ms/AppShell";
import { AnalyticsBoard } from "@/components/ms/Analytics";
import { SectionHeader } from "@/components/ms/Bits";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & Forecast · MARISENTINEL Admin" },
      { name: "description", content: "Incident trends, threat distribution, zone violations and simulated predictive threat forecasting." },
      { property: "og:title", content: "Analytics & Forecast · MARISENTINEL" },
      { property: "og:description", content: "System-wide maritime security analytics and predictive risk scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <SectionHeader title="Analytics & predictive forecast" subtitle="Aggregated across every zone, vessel and incident in the platform." />
      <AnalyticsBoard />
    </AppShell>
  ),
});
