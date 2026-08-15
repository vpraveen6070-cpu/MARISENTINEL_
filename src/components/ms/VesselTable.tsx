import { useMemo, useState } from "react";
import { Badge, Empty, RiskMeter, statusTone, timeAgo } from "./Bits";
import { TableWrap, btn, inputCls, td, th, tr } from "./Form";
import { riskBand } from "@/lib/ms/threat";
import type { Vessel, Zone } from "@/lib/ms/types";

export function VesselTable({
  vessels,
  zones,
  onSelect,
}: {
  vessels: Vessel[];
  zones: Zone[];
  onSelect?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState("");
  const [ais, setAis] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return vessels
      .filter((v) => {
        const matches =
          !term ||
          v.name.toLowerCase().includes(term) ||
          v.id.toLowerCase().includes(term) ||
          v.mmsi.includes(term) ||
          v.flag.toLowerCase().includes(term);
        const bandOk = !band || riskBand(v.risk).label === band;
        const aisOk = !ais || v.ais === ais;
        return matches && bandOk && aisOk;
      })
      .sort((a, b) => b.risk - a.risk);
  }, [vessels, q, band, ais]);

  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Search vessel, MMSI, flag…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={band} onChange={(e) => setBand(e.target.value)}>
          <option value="">All risk levels</option>
          {["Low", "Moderate", "Elevated", "High", "Critical"].map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select className={inputCls} value={ais} onChange={(e) => setAis(e.target.value)}>
          <option value="">All AIS states</option>
          <option value="active">AIS active</option>
          <option value="lost">AIS lost</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <Empty title="No vessels match the filters" hint="Try clearing the search term or risk filter." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Vessel</th>
              <th className={th}>Type / flag</th>
              <th className={th}>Speed / course</th>
              <th className={th}>Position</th>
              <th className={th}>AIS</th>
              <th className={th}>Zone</th>
              <th className={th}>Risk</th>
              {onSelect ? <th className={th}>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const zone = zones.find((z) => z.id === v.zoneId);
              return (
                <tr key={v.id} className={tr}>
                  <td className={td}>
                    <span className="font-medium">{v.name}</span>
                    <span className="mono-num block text-[11px] text-muted-foreground">
                      {v.id} · MMSI {v.mmsi}
                    </span>
                  </td>
                  <td className={`${td} text-xs`}>
                    {v.type}
                    <span className="block text-muted-foreground">{v.flag}</span>
                  </td>
                  <td className={`${td} mono-num text-xs`}>
                    {v.speed} kt
                    <span className="block text-muted-foreground">{v.course}°</span>
                  </td>
                  <td className={`${td} mono-num text-xs`}>
                    {v.lat.toFixed(2)}°N
                    <span className="block text-muted-foreground">{v.lng.toFixed(2)}°E</span>
                  </td>
                  <td className={td}>
                    <Badge tone={v.ais === "active" ? "ok" : "critical"}>{v.ais}</Badge>
                  </td>
                  <td className={`${td} text-xs`}>
                    {zone ? <Badge tone={statusTone(zone.classification)}>{zone.name}</Badge> : <span className="text-muted-foreground">Open water</span>}
                  </td>
                  <td className={td}>
                    <RiskMeter score={v.risk} compact />
                    <span className="mt-1 block text-[10px] text-muted-foreground">{timeAgo(v.lastUpdate)}</span>
                  </td>
                  {onSelect ? (
                    <td className={td}>
                      <button type="button" className={btn.tiny} onClick={() => onSelect(v.id)}>
                        Inspect
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
