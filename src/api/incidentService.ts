import { store } from "@/lib/ms/store";
import { mockLatency } from "./http";

export const incidentService = {
  list: () => mockLatency(store.get().incidents),
  get: (id: string) => mockLatency(store.get().incidents.find((i) => i.id === id) ?? null, 120),
  createFromAlert: (alertId: string) => mockLatency(store.createIncidentFromAlert(alertId), 200),
  assign: (incidentId: string, officerId: string) => {
    store.assignOfficer(incidentId, officerId);
    return mockLatency({ incidentId, officerId }, 180);
  },
};
