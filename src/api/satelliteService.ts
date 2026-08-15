import { store } from "@/lib/ms/store";
import { mockLatency } from "./http";

export const satelliteService = {
  /** GET /satellite/status */
  status: () => mockLatency(store.get().sources.find((s) => s.kind === "Satellite") ?? null, 140),
  /** POST /satellite/tasking */
  requestPass: (lat: number, lng: number) =>
    mockLatency({ accepted: true, etaMinutes: 42, target: { lat, lng }, sceneId: `SCN-${Date.now().toString().slice(-6)}` }, 400),
};
