import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import type { MapCanvasProps } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid-lines relative grid h-full w-full place-items-center overflow-hidden rounded-lg bg-surface-2/60", className)}>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Loading maritime chart…</p>
    </div>
  );
}

export function MapView({ className, height = "h-[460px]", ...props }: MapCanvasProps & { height?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border", height, className)}>
      <ClientOnly fallback={<MapSkeleton />}>
        <Suspense fallback={<MapSkeleton />}>
          <MapCanvas {...props} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
