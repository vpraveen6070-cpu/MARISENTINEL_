import { createFileRoute, Link } from "@tanstack/react-router";
import { Anchor, Waves } from "lucide-react";
import { Badge } from "@/components/ms/Bits";
import { Brand } from "@/components/ms/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MARISENTINEL — Autonomous Maritime Intelligence Platform" },
      {
        name: "description",
        content:
          "Maritime digital twin, predictive coastal intelligence and rule-based threat analytics for the Bay of Bengal. Role-based command, field and administration consoles.",
      },
      { property: "og:title", content: "MARISENTINEL — Autonomous Maritime Intelligence" },
      {
        property: "og:description",
        content: "Detect suspicious vessel behaviour, score threats, dispatch field officers and close incidents in one coastal security platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative flex h-screen w-full flex-col justify-between overflow-hidden bg-background">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />

      {/* Top header */}
      <header className="relative z-30 shrink-0 border-b border-border/50 bg-background/50 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <Link
            to="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main hero left-aligned container */}
      <main className="relative z-10 flex flex-1 items-center overflow-hidden px-4 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex max-w-2xl flex-col items-start text-left">
            <Badge tone="primary">
              <span className="ms-live-dot h-1.5 w-1.5 rounded-full bg-primary" /> Operational region · Bay of Bengal
            </Badge>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              MARISENTINEL
            </h1>

            <p className="mt-2 text-base font-medium text-foreground/80 sm:text-lg lg:text-xl">
              Autonomous Maritime Intelligence &amp; Coastal Security Platform
            </p>

            <p className="mt-4 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              A maritime digital twin fusing vessel traffic, satellite tasking and marine weather. Detects suspicious
              behaviour with a transparent rule-based engine and coordinates the full response chain from alert to field
              closure across command, field and administration consoles.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Enter the platform
              </Link>
            </div>

            <dl className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["22", "Tracked vessels"],
                ["8", "Security zones"],
                ["3", "Live data feeds"],
                ["0–100", "Threat score"],
              ].map(([v, k]) => (
                <div key={k} className="glass rounded-lg border border-border p-3 text-left">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
                  <dd className="mono-num mt-1 text-xl font-bold text-primary sm:text-2xl">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </main>

      {/* Bottom compact status bar */}
      <footer className="relative z-30 shrink-0 border-t border-border/50 bg-background/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2">
            <Anchor className="h-3.5 w-3.5 text-primary" /> MARISENTINEL · Autonomous Maritime Security
          </span>
          <span className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-primary" /> Demonstration environment · Bay of Bengal Grid
          </span>
        </div>
      </footer>
    </div>
  );
}
