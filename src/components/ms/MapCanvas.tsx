import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Incident, User, Vessel, Zone } from "@/lib/ms/types";

export interface MapLayers {
  vessels?: boolean;
  zones?: boolean;
  threats?: boolean;
  incidents?: boolean;
  officers?: boolean;
  weather?: boolean;
  satellite?: boolean;
  trails?: boolean;
}

export interface MapCanvasProps {
  center?: [number, number];
  zoom?: number;
  vessels?: Vessel[];
  zones?: Zone[];
  incidents?: Incident[];
  officers?: User[];
  layers?: MapLayers;
  focusVesselId?: string | null;
  routeLine?: Array<[number, number]> | null;
  onVesselClick?: (id: string) => void;
  className?: string;
}

const ZONE_COLOR: Record<Zone["classification"], string> = {
  Normal: "#4bd6b0",
  Monitoring: "#6fc7f0",
  Restricted: "#f0b23c",
  "High Risk": "#f0743c",
  Critical: "#f0466a",
};

function riskColor(risk: number): string {
  if (risk > 80) return "#f0466a";
  if (risk > 60) return "#f0743c";
  if (risk > 40) return "#f0b23c";
  return "#5ce0c0";
}

function vesselIcon(v: Vessel) {
  const color = riskColor(v.risk);
  const size = v.risk > 80 ? 18 : 14;
  return L.divIcon({
    className: "ms-marker",
    html: `<span style="background:${color};width:${size - 4}px;height:${size - 4}px;${
      v.risk > 80 ? "outline:2px solid " + color + ";outline-offset:3px;" : ""
    }"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function pinIcon(color: string, glyph: string) {
  return L.divIcon({
    className: "ms-marker",
    html: `<div style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:${color}22;border:1.5px solid ${color};color:${color};font:600 11px/1 'IBM Plex Sans',sans-serif">${glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function MapCanvas({
  center = [15.5, 87.5],
  zoom = 5,
  vessels = [],
  zones = [],
  incidents = [],
  officers = [],
  layers = {},
  focusVesselId = null,
  routeLine = null,
  onVesselClick,
  className,
}: MapCanvasProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onVesselClick);
  clickRef.current = onVesselClick;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    if (layers.zones !== false) {
      for (const z of zones) {
        const color = ZONE_COLOR[z.classification];
        L.circle([z.lat, z.lng], {
          radius: z.radiusKm * 1000,
          color,
          weight: z.status === "active" ? 1.6 : 1,
          dashArray: z.status === "active" ? undefined : "4 6",
          fillColor: color,
          fillOpacity: 0.07,
        })
          .bindTooltip(`${z.name} — ${z.classification}`, { direction: "top" })
          .bindPopup(
            `<strong>${z.name}</strong><br/>${z.classification} · priority ${z.priority}<br/>Radius ${z.radiusKm} km · ${z.status}`,
          )
          .addTo(group);
      }
    }

    if (layers.weather) {
      L.circle([16.4, 89.6], {
        radius: 260000,
        color: "#6fc7f0",
        weight: 1,
        dashArray: "6 8",
        fillColor: "#6fc7f0",
        fillOpacity: 0.06,
      })
        .bindTooltip("Squall system — wind 24 kt, wave 3.1 m", { direction: "top" })
        .addTo(group);
    }

    if (layers.satellite) {
      L.rectangle(
        [
          [10.5, 90.5],
          [14.5, 94.5],
        ],
        { color: "#a9b4ff", weight: 1, dashArray: "3 6", fillOpacity: 0.04 },
      )
        .bindTooltip("Satellite tasking footprint · next pass 42 min", { direction: "top" })
        .addTo(group);
    }

    if (layers.vessels !== false) {
      for (const v of vessels) {
        if (layers.threats && v.risk < 41) continue;
        const marker = L.marker([v.lat, v.lng], { icon: vesselIcon(v) })
          .bindTooltip(`${v.name} · risk ${v.risk}`, { direction: "top" })
          .bindPopup(
            `<strong>${v.name}</strong><br/>${v.id} · ${v.type} · ${v.flag}<br/>Speed ${v.speed} kt · course ${v.course}°<br/>AIS ${v.ais} · risk ${v.risk}`,
          )
          .addTo(group);
        marker.on("click", () => clickRef.current?.(v.id));
        if ((layers.trails || focusVesselId === v.id) && v.trail.length > 1) {
          L.polyline(v.trail, { color: riskColor(v.risk), weight: 1.6, opacity: 0.75, dashArray: "5 5" }).addTo(group);
        }
      }
    }

    if (layers.incidents !== false) {
      for (const inc of incidents) {
        L.marker([inc.lat, inc.lng], { icon: pinIcon("#f0466a", "!") })
          .bindTooltip(`${inc.id} · ${inc.category}`, { direction: "top" })
          .bindPopup(`<strong>${inc.id}</strong><br/>${inc.title}<br/>Status ${inc.status} · risk ${inc.risk}`)
          .addTo(group);
      }
    }

    if (layers.officers !== false) {
      for (const o of officers) {
        if (o.lat == null || o.lng == null) continue;
        L.marker([o.lat, o.lng], { icon: pinIcon("#5ce0c0", "F") })
          .bindTooltip(`${o.name} · ${o.availability ?? "unknown"}`, { direction: "top" })
          .addTo(group);
      }
    }

    if (routeLine && routeLine.length > 1) {
      L.polyline(routeLine, { color: "#6fc7f0", weight: 2.4, dashArray: "8 6" }).addTo(group);
    }
  }, [vessels, zones, incidents, officers, layers, focusVesselId, routeLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusVesselId) return;
    const v = vessels.find((x) => x.id === focusVesselId);
    if (v) map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 7), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVesselId]);

  return <div ref={elRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
