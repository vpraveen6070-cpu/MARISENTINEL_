import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Empty, KeyVal, Panel, RiskMeter, Timeline, fmtTime, statusTone, timeAgo } from "./Bits";
import { Field, Modal, btn, inputCls } from "./Form";
import { MapView } from "./MapView";
import { store, useMsState } from "@/lib/ms/store";
import { ROLE_LABEL } from "./nav";
import type { EvidenceType, Incident } from "@/lib/ms/types";

export type WorkspaceView =
  | "incidents" | "assignments" | "threats" | "evidence" | "twin"
  | "fieldhome" | "fieldassign" | "fieldmap" | "fieldactive" | "fieldupdates" | "fieldevidence" | "fieldreports"
  | "notifications" | "profile";

export function Workspace({ view }: { view: WorkspaceView }) {
  switch (view) {
    case "incidents": return <Incidents />;
    case "assignments": return <Assignments />;
    case "threats": return <Threats />;
    case "evidence": return <EvidenceReview />;
    case "twin": return <Twin />;
    case "fieldhome": return <FieldHome />;
    case "fieldassign": return <FieldAssign />;
    case "fieldmap": return <FieldMap />;
    case "fieldactive": return <FieldActive />;
    case "fieldupdates": return <FieldUpdates />;
    case "fieldevidence": return <FieldEvidence />;
    case "fieldreports": return <FieldReports />;
    case "notifications": return <Notifications />;
    default: return <Profile />;
  }
}

function useMine(): Incident[] {
  const s = useMsState();
  const id = s.session?.userId;
  return s.incidents.filter((i) => i.assignedTo === id);
}

/* ---------------- command ---------------- */

function Incidents() {
  const s = useMsState();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const inc = s.incidents.find((i) => i.id === open) ?? null;

  return (
    <>
      <div className="space-y-3">
        {s.incidents.length === 0 ? <Empty title="No incidents yet" hint="Confirm an alert to open an incident." /> : s.incidents.map((i) => (
          <Panel key={i.id} title={`${i.id} · ${i.title}`} actions={<Badge tone={statusTone(i.status)}>{i.status}</Badge>}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-sm text-muted-foreground">{i.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(i.riskLevel)}>{i.riskLevel}</Badge>
                  <Badge tone="neutral">{i.category}</Badge>
                  <Badge tone="neutral">{i.vesselName}</Badge>
                  {i.missionStatus ? <Badge tone="primary">{i.missionStatus}</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btn.tiny} onClick={() => setOpen(i.id)}>Open timeline</button>
                  {i.status !== "Closed" ? (
                    <button type="button" className={btn.tiny} onClick={() => { store.closeIncident(i.id, "Closed by command officer after review."); toast.success("Incident closed"); }}>Close incident</button>
                  ) : (
                    <button type="button" className={btn.tiny} onClick={() => { store.reopenIncident(i.id, "Reopened for further review."); toast.success("Incident reopened"); }}>Reopen</button>
                  )}
                </div>
              </div>
              <div>
                <RiskMeter score={i.risk} />
                <div className="mt-2">
                  <KeyVal k="Detected" v={fmtTime(i.detectedAt)} />
                  <KeyVal k="Assigned to" v={s.users.find((u) => u.id === i.assignedTo)?.name ?? "Unassigned"} />
                  <KeyVal k="Deadline" v={i.deadline ? timeAgo(i.deadline) : "—"} />
                  <KeyVal k="Position" v={`${i.lat.toFixed(2)}°N ${i.lng.toFixed(2)}°E`} />
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={!!inc} onClose={() => { setOpen(null); setNote(""); }} title={inc ? `${inc.id} timeline` : ""}>
        {inc ? (
          <>
            <Timeline entries={inc.timeline} />
            {inc.report ? (
              <div className="mt-4 panel p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Field report</p>
                <KeyVal k="Outcome" v={inc.report.finalStatus} />
                <p className="mt-2 text-sm">{inc.report.findings}</p>
                <p className="mt-1 text-xs text-muted-foreground">{inc.report.actionTaken}</p>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              <Field label="Add closing note">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewed evidence, threat neutralised…" />
              </Field>
              <button type="button" className={btn.primary} onClick={() => { store.closeIncident(inc.id, note || "Closed by command officer."); toast.success("Incident closed"); setOpen(null); setNote(""); }}>
                Close with note
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}

function Assignments() {
  const s = useMsState();
  const officers = s.users.filter((u) => u.role === "field");
  const [target, setTarget] = useState("");
  const [officer, setOfficer] = useState("");
  const [hours, setHours] = useState("6");
  const unassigned = s.incidents.filter((i) => !i.assignedTo && i.status !== "Closed");

  return (
    <div className="space-y-4">
      <Panel title="Create assignment">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Incident">
            <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select incident</option>
              {unassigned.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.title}</option>)}
            </select>
          </Field>
          <Field label="Field officer">
            <select className={inputCls} value={officer} onChange={(e) => setOfficer(e.target.value)}>
              <option value="">Select officer</option>
              {officers.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.availability})</option>)}
            </select>
          </Field>
          <Field label="Deadline (hours)">
            <input className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="button" className={btn.primary} onClick={() => {
              if (!target || !officer) { toast.error("Select an incident and an officer."); return; }
              store.assignOfficer(target, officer, Number(hours) || 6);
              toast.success("Officer assigned and notified");
              setTarget(""); setOfficer("");
            }}>Assign officer</button>
          </div>
        </div>
      </Panel>

      <Panel title="Assignment status" bodyClassName="p-0">
        {s.incidents.filter((i) => i.assignedTo).length === 0 ? <div className="p-4"><Empty title="No assignments yet" /></div> : s.incidents.filter((i) => i.assignedTo).map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0">
            <div className="min-w-52">
              <p className="text-sm font-medium">{i.id} · {i.title}</p>
              <p className="text-[11px] text-muted-foreground">{s.users.find((u) => u.id === i.assignedTo)?.name} · assigned {timeAgo(i.assignedAt ?? "")}</p>
            </div>
            <Badge tone={statusTone(i.status)}>{i.status}</Badge>
            {i.missionStatus ? <Badge tone="primary">{i.missionStatus}</Badge> : null}
            <span className="ml-auto text-[11px] text-muted-foreground">Deadline {i.deadline ? timeAgo(i.deadline) : "—"}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Threats() {
  const s = useMsState();
  const flagged = s.vessels.filter((v) => v.risk >= 41).sort((a, b) => b.risk - a.risk);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {flagged.length === 0 ? <Empty title="No flagged vessels" /> : flagged.map((v) => (
        <Panel key={v.id} title={v.name} actions={<Badge tone={v.risk > 80 ? "critical" : "warn"}>{v.risk}</Badge>}>
          <RiskMeter score={v.risk} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {v.behaviours.length === 0 ? <span className="text-xs text-muted-foreground">No anomalies</span> : v.behaviours.map((b) => <Badge key={b} tone="warn">{b}</Badge>)}
          </div>
          <div className="mt-3">
            <KeyVal k="Zone" v={s.zones.find((z) => z.id === v.zoneId)?.name ?? "Open water"} />
            <KeyVal k="Speed / course" v={`${v.speed} kt · ${v.course}°`} />
            <KeyVal k="AIS" v={v.ais} />
            <KeyVal k="Destination" v={v.destination} />
          </div>
        </Panel>
      ))}
    </div>
  );
}

function EvidenceReview() {
  const s = useMsState();
  return (
    <div className="space-y-3">
      {s.evidence.length === 0 ? <Empty title="No evidence submitted yet" hint="Field officers can attach evidence to active incidents." /> : s.evidence.map((e) => (
        <Panel key={e.id} title={`${e.type} · ${e.incidentId}`} actions={<span className="text-[11px] text-muted-foreground">{fmtTime(e.ts)}</span>}>
          <p className="text-sm">{e.description}</p>
          {e.notes ? <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p> : null}
          <div className="mt-2">
            <KeyVal k="Submitted by" v={e.submittedBy} />
            <KeyVal k="Geotag" v={`${e.lat.toFixed(3)}°N ${e.lng.toFixed(3)}°E`} />
            {e.fileName ? <KeyVal k="File" v={e.fileName} /> : null}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Twin() {
  const s = useMsState();
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-2" bodyClassName="p-0">
        <MapView height="h-[520px]" vessels={s.vessels} zones={s.zones} incidents={s.incidents.filter((i) => i.status !== "Closed")} officers={s.users.filter((u) => u.role === "field")} layers={{ satellite: true, threats: true, zones: true, vessels: true, incidents: true, officers: true }} />
      </Panel>
      <div className="space-y-4">
        <Panel title="Theatre state">
          <KeyVal k="Region" v="Bay of Bengal" />
          <KeyVal k="Vessels simulated" v={s.vessels.length} />
          <KeyVal k="Zones modelled" v={s.zones.length} />
          <KeyVal k="Engine cycles" v={s.tick} />
          <KeyVal k="Sea state" v={s.weather.seaState} />
        </Panel>
        <Panel title="Zone digital twin" bodyClassName="p-0">
          <div className="max-h-[300px] overflow-y-auto">
            {s.zones.map((z) => (
              <div key={z.id} className="border-b border-border/50 px-4 py-2.5 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{z.name}</span>
                  <Badge tone={statusTone(z.classification)}>{z.classification}</Badge>
                </div>
                <p className="mono-num text-[11px] text-muted-foreground">
                  {z.radiusKm} km radius · {s.vessels.filter((v) => v.zoneId === z.id).length} contacts inside
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- field ---------------- */

function FieldHome() {
  const s = useMsState();
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Current mission" className="lg:col-span-2">
        {active ? (
          <>
            <p className="text-base font-semibold">{active.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={statusTone(active.status)}>{active.status}</Badge>
              {active.missionStatus ? <Badge tone="primary">{active.missionStatus}</Badge> : null}
              <Badge tone={statusTone(active.riskLevel)}>{active.riskLevel}</Badge>
            </div>
            <div className="mt-3">
              <KeyVal k="Vessel" v={active.vesselName} />
              <KeyVal k="Location" v={`${active.lat.toFixed(2)}°N ${active.lng.toFixed(2)}°E`} />
              <KeyVal k="Deadline" v={active.deadline ? timeAgo(active.deadline) : "—"} />
            </div>
          </>
        ) : <Empty title="No active mission" hint="You will be notified when command assigns you an incident." />}
      </Panel>
      <Panel title="My record">
        <KeyVal k="Assignments" v={mine.length} />
        <KeyVal k="Completed" v={mine.filter((i) => i.missionStatus === "Completed").length} />
        <KeyVal k="Reports filed" v={mine.filter((i) => i.report).length} />
        <KeyVal k="Availability" v={s.users.find((u) => u.id === s.session?.userId)?.availability ?? "—"} />
      </Panel>
    </div>
  );
}

function FieldAssign() {
  const mine = useMine();
  return (
    <div className="space-y-3">
      {mine.length === 0 ? <Empty title="No assignments" /> : mine.map((i) => (
        <Panel key={i.id} title={`${i.id} · ${i.title}`} actions={<Badge tone={statusTone(i.status)}>{i.status}</Badge>}>
          <p className="text-sm text-muted-foreground">{i.description}</p>
          <div className="mt-3">
            <KeyVal k="Vessel" v={i.vesselName} />
            <KeyVal k="Risk" v={`${i.riskLevel} (${i.risk})`} />
            <KeyVal k="Deadline" v={i.deadline ? fmtTime(i.deadline) : "—"} />
          </div>
          {i.missionStatus === "Assigned" ? (
            <div className="mt-3 flex gap-2">
              <button type="button" className={btn.primary} onClick={() => { store.respondToAssignment(i.id, true, "Assignment accepted."); toast.success("Assignment accepted"); }}>Accept</button>
              <button type="button" className={btn.danger} onClick={() => { store.respondToAssignment(i.id, false, "Unable to respond."); toast.success("Assignment declined"); }}>Decline</button>
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

function FieldMap() {
  const s = useMsState();
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  const me = s.users.find((u) => u.id === s.session?.userId);
  return (
    <Panel bodyClassName="p-0">
      <MapView
        height="h-[calc(100vh-14rem)]"
        {...(active ? { center: [active.lat, active.lng] as [number, number] } : {})}
        zoom={active ? 8 : 5}
        vessels={s.vessels.filter((v) => !active || v.id === active.vesselId)}
        zones={s.zones}
        incidents={active ? [active] : []}
        officers={me ? [me] : []}
        layers={{ vessels: true, zones: true, incidents: true, officers: true, threats: true }}
      />
    </Panel>
  );
}

const MISSION_STEPS = ["Accepted", "En Route", "On Scene", "Investigating", "Evidence Submitted", "Completed"] as const;

function FieldActive() {
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  const [note, setNote] = useState("");
  if (!active) return <Empty title="No active incident" hint="Accept an assignment to begin a mission." />;
  return (
    <Panel title={`${active.id} · ${active.title}`} actions={<Badge tone="primary">{active.missionStatus ?? "Assigned"}</Badge>}>
      <p className="text-sm text-muted-foreground">{active.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MISSION_STEPS.map((step) => (
          <button key={step} type="button" className={active.missionStatus === step ? btn.primary : btn.tiny}
            onClick={() => { store.updateMission(active.id, step, note || `Mission status set to ${step}.`); toast.success(`Status: ${step}`); setNote(""); }}>
            {step}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Optional note with next status update">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approaching target vessel…" />
        </Field>
      </div>
      <div className="mt-4">
        <Timeline entries={active.timeline} />
      </div>
    </Panel>
  );
}

function FieldUpdates() {
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  const [note, setNote] = useState("");
  if (!active) return <Empty title="No active incident" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Post an update">
        <Field label="Update note">
          <textarea className={`${inputCls} min-h-28`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Boarded vessel, crew cooperative, inspecting hold." />
        </Field>
        <button type="button" className={btn.primary} onClick={() => {
          if (!note.trim()) { toast.error("Write an update first."); return; }
          store.updateMission(active.id, active.missionStatus ?? "Investigating", note);
          toast.success("Update sent to command");
          setNote("");
        }}>Send update</button>
      </Panel>
      <Panel title="Mission timeline">
        <Timeline entries={active.timeline} />
      </Panel>
    </div>
  );
}

const EV_TYPES: EvidenceType[] = ["Photograph", "Video", "Document", "Observation", "Sensor Data"];

function FieldEvidence() {
  const s = useMsState();
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  const [type, setType] = useState<EvidenceType>("Photograph");
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState("");
  const items = useMemo(() => s.evidence.filter((e) => e.incidentId === active?.id), [s.evidence, active]);
  if (!active) return <Empty title="No active incident" hint="Evidence can only be attached to an active mission." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Submit evidence">
        <Field label="Evidence type">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
            {EV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Unregistered cargo containers on deck" />
        </Field>
        <Field label="File reference (optional)">
          <input className={inputCls} value={file} onChange={(e) => setFile(e.target.value)} placeholder="IMG_2043.jpg" />
        </Field>
        <Field label="Notes">
          <textarea className={`${inputCls} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="button" className={btn.primary} onClick={() => {
          if (!desc.trim()) { toast.error("Add a description."); return; }
          store.addEvidence({ incidentId: active.id, type, description: desc, notes, fileName: file || null, lat: active.lat, lng: active.lng });
          toast.success("Evidence submitted");
          setDesc(""); setNotes(""); setFile("");
        }}>Submit evidence</button>
      </Panel>
      <Panel title="Submitted evidence" bodyClassName="p-0">
        {items.length === 0 ? <div className="p-4"><Empty title="Nothing submitted yet" /></div> : items.map((e) => (
          <div key={e.id} className="border-b border-border/50 px-4 py-3 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="primary">{e.type}</Badge>
              <span className="text-[11px] text-muted-foreground">{fmtTime(e.ts)}</span>
            </div>
            <p className="mt-1 text-sm">{e.description}</p>
            {e.fileName ? <p className="mono-num text-[11px] text-muted-foreground">{e.fileName}</p> : null}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function FieldReports() {
  const mine = useMine();
  const active = mine.find((i) => i.status !== "Closed") ?? null;
  const [finalStatus, setFinalStatus] = useState("Threat neutralised");
  const [findings, setFindings] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="File final report">
        {active ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{active.id} · {active.title}</p>
            <Field label="Outcome">
              <select className={inputCls} value={finalStatus} onChange={(e) => setFinalStatus(e.target.value)}>
                {["Threat neutralised", "No threat found", "Escalated to authorities", "Vessel detained", "Inconclusive"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Findings">
              <textarea className={`${inputCls} min-h-24`} value={findings} onChange={(e) => setFindings(e.target.value)} />
            </Field>
            <Field label="Action taken">
              <textarea className={`${inputCls} min-h-20`} value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
            </Field>
            <Field label="Additional notes">
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <button type="button" className={btn.primary} onClick={() => {
              if (!findings.trim()) { toast.error("Findings are required."); return; }
              store.submitReport(active.id, { finalStatus, findings, actionTaken, notes, completedAt: new Date().toISOString() });
              toast.success("Report submitted to command");
              setFindings(""); setActionTaken(""); setNotes("");
            }}>Submit report</button>
          </>
        ) : <Empty title="No active incident to report on" />}
      </Panel>
      <Panel title="My submitted reports" bodyClassName="p-0">
        {mine.filter((i) => i.report).length === 0 ? <div className="p-4"><Empty title="No reports filed yet" /></div> : mine.filter((i) => i.report).map((i) => (
          <div key={i.id} className="border-b border-border/50 px-4 py-3 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{i.id}</span>
              <Badge tone={statusTone(i.status)}>{i.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{i.report?.finalStatus} · {fmtTime(i.report?.completedAt ?? "")}</p>
            <p className="mt-1 text-sm">{i.report?.findings}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ---------------- shared ---------------- */

function Notifications() {
  const s = useMsState();
  const role = s.session?.role;
  const mine = s.notifications.filter((n) => n.audience === role || n.audience === "all");
  return (
    <Panel title={`${mine.filter((n) => !n.read).length} unread`} bodyClassName="p-0"
      actions={<button type="button" className={btn.tiny} onClick={() => role && store.markAllRead(role)}>Mark all read</button>}>
      {mine.length === 0 ? <div className="p-4"><Empty title="No notifications" /></div> : mine.map((n) => (
        <button key={n.id} type="button" onClick={() => store.markNotificationRead(n.id)}
          className={`block w-full border-b border-border/50 px-4 py-3 text-left last:border-0 hover:bg-accent/40 ${n.read ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(n.severity)}>{n.severity}</Badge>
            <span className="text-sm font-medium">{n.title}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(n.ts)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
        </button>
      ))}
    </Panel>
  );
}

function Profile() {
  const s = useMsState();
  const me = s.users.find((u) => u.id === s.session?.userId);
  const acts = s.audit.filter((a) => a.user === me?.name).slice(0, 10);
  if (!me) return <Empty title="No session" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Account">
        <KeyVal k="Name" v={me.name} />
        <KeyVal k="Username" v={me.username} />
        <KeyVal k="Role" v={ROLE_LABEL[me.role]} />
        <KeyVal k="Region" v={me.region} />
        <KeyVal k="Status" v={me.status} />
        <KeyVal k="Last login" v={me.lastLogin ? fmtTime(me.lastLogin) : "—"} />
        {me.availability ? <KeyVal k="Availability" v={me.availability} /> : null}
      </Panel>
      <Panel title="Recent activity" bodyClassName="p-0">
        {acts.length === 0 ? <div className="p-4"><Empty title="No recorded activity" /></div> : acts.map((a) => (
          <div key={a.id} className="border-b border-border/50 px-4 py-2.5 last:border-0">
            <p className="text-sm">{a.action}</p>
            <p className="mono-num text-[11px] text-muted-foreground">{fmtTime(a.ts)} · {a.module}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}
