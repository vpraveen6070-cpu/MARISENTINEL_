import { store } from "@/lib/ms/store";
import type { Vessel } from "@/lib/ms/types";
import { mockLatency } from "./http";

export const aisService = {
  /** GET /ais/vessels */
  listVessels: () => mockLatency<Vessel[]>(store.get().vessels),
  /** GET /ais/vessels/:id */
  getVessel: (id: string) => mockLatency(store.get().vessels.find((v) => v.id === id) ?? null),
  /** GET /ais/status */
  status: () => mockLatency(store.get().sources.find((s) => s.kind === "AIS") ?? null, 120),
};
