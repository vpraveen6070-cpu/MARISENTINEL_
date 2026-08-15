import { store } from "@/lib/ms/store";
import type { AlertStatus } from "@/lib/ms/types";
import { mockLatency } from "./http";

export const alertService = {
  list: () => mockLatency(store.get().alerts),
  setStatus: (id: string, status: AlertStatus) => {
    store.setAlertStatus(id, status);
    return mockLatency({ id, status }, 120);
  },
};
