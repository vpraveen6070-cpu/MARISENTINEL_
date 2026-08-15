import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, SectionHeader, statusTone, timeAgo } from "@/components/ms/Bits";
import { Field, Modal, TableWrap, btn, inputCls, td, th, tr } from "@/components/ms/Form";
import { store, useMsState } from "@/lib/ms/store";
import type { Severity, ThreatRule } from "@/lib/ms/types";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({
    meta: [
      { title: "Threat Rules · MARISENTINEL Admin" },
      { name: "description", content: "Configure the rule-based detection engine: zone entry, AIS loss, loitering, speed and route anomalies." },
      { property: "og:title", content: "Threat Rules · MARISENTINEL" },
      { property: "og:description", content: "Tune thresholds and severities for maritime threat detection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <RulesPage />
    </AppShell>
  ),
});

function RulesPage() {
  const s = useMsState();
  const [editing, setEditing] = useState<ThreatRule | null>(null);
  const [threshold, setThreshold] = useState("");
  const [severity, setSeverity] = useState<Severity>("High");

  return (
    <>
      <SectionHeader
        title="Threat rule management"
        subtitle="These rules drive the scoring engine. Disabling a rule removes its weight from every vessel's risk score."
        actions={<Badge tone="primary">{s.rules.filter((r) => r.enabled).length} of {s.rules.length} enabled</Badge>}
      />

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Rule</th>
            <th className={th}>Severity</th>
            <th className={th}>Threshold</th>
            <th className={th}>Last triggered</th>
            <th className={th}>State</th>
            <th className={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {s.rules.map((r) => (
            <tr key={r.id} className={tr}>
              <td className={td}>
                <span className="font-medium">{r.name}</span>
                <span className="block max-w-md text-xs text-muted-foreground">{r.description}</span>
              </td>
              <td className={td}>
                <Badge tone={statusTone(r.severity)}>{r.severity}</Badge>
              </td>
              <td className={`${td} mono-num text-xs`}>{r.threshold}</td>
              <td className={`${td} text-xs text-muted-foreground`}>{r.lastTriggered ? timeAgo(r.lastTriggered) : "never"}</td>
              <td className={td}>
                <Badge tone={r.enabled ? "ok" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</Badge>
              </td>
              <td className={td}>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={btn.tiny}
                    onClick={() => {
                      store.toggleRule(r.id);
                      toast.success(`${r.name} ${r.enabled ? "disabled" : "enabled"}`);
                    }}
                  >
                    {r.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className={btn.tiny}
                    onClick={() => {
                      setEditing(r);
                      setThreshold(r.threshold);
                      setSeverity(r.severity);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""}>
        <div className="space-y-3">
          <Field label="Threshold">
            <input className={inputCls} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <Field label="Severity">
            <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {["Low", "Medium", "High", "Critical"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn.ghost} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                if (!threshold.trim()) {
                  toast.error("Threshold cannot be empty.");
                  return;
                }
                store.updateRule(editing!.id, { threshold, severity });
                toast.success("Rule updated");
                setEditing(null);
              }}
            >
              Save rule
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
