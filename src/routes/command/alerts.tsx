import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, SectionHeader, fmtTime, statusTone } from "@/components/ms/Bits";
import { TableWrap, btn, inputCls, td, th, tr } from "@/components/ms/Form";
import { store, useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/command/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Management · MARISENTINEL" },
      { name: "description", content: "Review, investigate, confirm or dismiss automated maritime threat alerts and escalate them into incidents." },
      { property: "og:title", content: "Alert Management · MARISENTINEL" },
      { property: "og:description", content: "Review, investigate, confirm or dismiss automated maritime threat alerts and escalate them into incidents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="command">
      <AlertsPage />
    </AppShell>
  ),
});

function AlertsPage() {
  const s = useMsState();
  const [sev, setSev] = useState("");
  const [st, setSt] = useState("");
  const rows = s.alerts.filter((a) => (!sev || a.severity === sev) && (!st || a.status === st));

  return (
    <>
      <SectionHeader title="Alert management" subtitle="Confirming an alert automatically opens a tracked incident for assignment." />
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <select className={inputCls} value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="">All severities</option>
          {["Low", "Medium", "High", "Critical"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">All statuses</option>
          {["New", "Investigating", "Confirmed", "False Alarm", "Resolved"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty title="No alerts match the filters" /> : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Time</th>
              <th className={th}>Vessel</th>
              <th className={th}>Threat</th>
              <th className={th}>Zone</th>
              <th className={th}>Severity</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={tr}>
                <td className={`${td} mono-num whitespace-nowrap text-xs text-muted-foreground`}>{fmtTime(a.ts)}</td>
                <td className={td}>
                  <span className="text-sm font-medium">{a.vesselName}</span>
                  <span className="mono-num block text-[11px] text-muted-foreground">risk {a.risk}</span>
                </td>
                <td className={`${td} text-xs`}>
                  {a.threatType}
                  <span className="block text-muted-foreground">{a.behaviours.slice(0, 2).join(" · ")}</span>
                </td>
                <td className={`${td} text-xs`}>{a.zoneName}</td>
                <td className={td}><Badge tone={statusTone(a.severity)}>{a.severity}</Badge></td>
                <td className={td}><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1.5">
                    {a.status === "New" ? (
                      <button type="button" className={btn.tiny} onClick={() => { store.setAlertStatus(a.id, "Investigating"); toast.success("Marked as investigating"); }}>Investigate</button>
                    ) : null}
                    {a.status !== "Confirmed" && a.status !== "Resolved" ? (
                      <button type="button" className={btn.tiny} onClick={() => { const id = store.createIncidentFromAlert(a.id); toast.success(id ? `Incident ${id} created` : "Incident created"); }}>Confirm threat</button>
                    ) : null}
                    {a.status !== "False Alarm" && a.status !== "Confirmed" ? (
                      <button type="button" className={btn.tiny} onClick={() => { store.setAlertStatus(a.id, "False Alarm"); toast.success("Marked as false alarm"); }}>False alarm</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
