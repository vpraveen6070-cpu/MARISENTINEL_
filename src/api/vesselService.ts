import { store } from "@/lib/ms/store";
import { computeRisk, recommendedAction, threatTypeFor, zoneOf } from "@/lib/ms/threat";
import { mockLatency } from "./http";

export const vesselService = {
  suspicious: () => mockLatency(store.get().vessels.filter((v) => v.risk >= 41)),
  /** Rule-based threat assessment for one vessel (simulated engine, not ML). */
  assess: (id: string) => {
    const s = store.get();
    const v = s.vessels.find((x) => x.id === id);
    if (!v) return mockLatency(null, 80);
    const zone = zoneOf(v, s.zones);
    return mockLatency({
      vessel: v,
      zone,
      score: computeRisk(v.behaviours, zone, v.speed),
      threatType: threatTypeFor(v.behaviours),
      recommendation: recommendedAction(v.risk),
    });
  },
};
