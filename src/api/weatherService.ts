import { store } from "@/lib/ms/store";
import { mockLatency } from "./http";

export const weatherService = {
  /** GET /weather/marine */
  current: () => mockLatency(store.get().weather, 160),
  status: () => mockLatency(store.get().sources.find((s) => s.kind === "Weather") ?? null, 120),
};
