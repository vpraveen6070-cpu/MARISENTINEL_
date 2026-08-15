import type { Severity, Vessel, VesselBehaviour, Zone } from "./types";

/** Rule-based simulation (not machine learning) used by the prototype engine. */
export const BEHAVIOUR_WEIGHTS: Record<VesselBehaviour, number> = {
  "Restricted zone entry": 26,
  "AIS interruption": 22,
  "Speed anomaly": 12,
  "Sudden course change": 14,
  Loitering: 16,
  "Route deviation": 15,
  "Suspicious proximity": 13,
  "Extended presence in sensitive area": 11,
};

export const ZONE_WEIGHT: Record<Zone["classification"], number> = {
  Normal: 0,
  Monitoring: 4,
  Restricted: 12,
  "High Risk": 16,
  Critical: 20,
};

export function riskBand(score: number): { label: Severity | "Elevated" | "Moderate"; tone: string } {
  if (score <= 20) return { label: "Low", tone: "ok" };
  if (score <= 40) return { label: "Moderate", tone: "info" };
  if (score <= 60) return { label: "Elevated", tone: "warn" };
  if (score <= 80) return { label: "High", tone: "danger" };
  return { label: "Critical", tone: "critical" };
}

export function severityFromScore(score: number): Severity {
  if (score <= 20) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 80) return "High";
  return "Critical";
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function zoneOf(vessel: Pick<Vessel, "lat" | "lng">, zones: Zone[]): Zone | null {
  let best: Zone | null = null;
  for (const z of zones) {
    if (z.status !== "active") continue;
    if (distanceKm(vessel.lat, vessel.lng, z.lat, z.lng) <= z.radiusKm) {
      if (!best || ZONE_WEIGHT[z.classification] > ZONE_WEIGHT[best.classification]) best = z;
    }
  }
  return best;
}

/** Recomputes the 0-100 threat score from detected behaviours and zone context. */
export function computeRisk(
  behaviours: VesselBehaviour[],
  zone: Zone | null,
  speed: number,
): number {
  let score = 6;
  for (const b of behaviours) score += BEHAVIOUR_WEIGHTS[b] ?? 8;
  if (zone) score += ZONE_WEIGHT[zone.classification];
  if (speed < 1.2) score += 4;
  if (speed > 22) score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function recommendedAction(score: number): string {
  if (score > 80) return "Dispatch field officer immediately and escalate to coastal command";
  if (score > 60) return "Open investigation, request satellite pass and prepare interception";
  if (score > 40) return "Increase monitoring frequency and verify AIS identity";
  if (score > 20) return "Keep under passive observation";
  return "No action required";
}

export function threatTypeFor(behaviours: VesselBehaviour[]): string {
  if (behaviours.includes("Restricted zone entry")) return "Unauthorized zone entry";
  if (behaviours.includes("AIS interruption")) return "AIS blackout";
  if (behaviours.includes("Loitering")) return "Vessel loitering";
  if (behaviours.includes("Route deviation")) return "Route deviation";
  if (behaviours.includes("Speed anomaly")) return "Speed anomaly";
  if (behaviours.includes("Suspicious proximity")) return "Suspicious proximity";
  return "Behavioural anomaly";
}
