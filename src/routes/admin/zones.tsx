import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, Panel, SectionHeader, statusTone } from "@/components/ms/Bits";
import { Field, Modal, btn, inputCls } from "@/components/ms/Form";
import { MapView } from "@/components/ms/MapView";
import { store, useMsState } from "@/lib/ms/store";
import type { Zone, ZoneClass } from "@/lib/ms/types";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({
    meta: [
      { title: "Security Zones · MARISENTINEL Admin" },
      { name: "description", content: "Create and classify maritime security zones across the Bay of Bengal with priority and status control." },
      { property: "og:title", content: "Security Zones · MARISENTINEL" },
      { property: "og:description", content: "Zone boundaries, classifications and priorities on a live maritime chart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <ZonesPage />
    </AppShell>
  ),
});

const CLASSES: ZoneClass[] = ["Normal", "Monitoring", "Restricted", "High Risk", "Critical"];
const BLANK = {
  name: "",
  classification: "Monitoring" as ZoneClass,
  priority: "Medium" as Zone["priority"],
  status: "active" as Zone["status"],
  lat: "15.5",
  lng: "88.0",
  radiusKm: "60",
  notes: "",
};

function ZonesPage() {
  const s = useMsState();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK });
    setError("");
    setOpen(true);
  }
  function openEdit(z: Zone) {
    setEditing(z);
    setForm({
      name: z.name,
      classification: z.classification,
      priority: z.priority,
      status: z.status,
      lat: String(z.lat),
      lng: String(z.lng),
      radiusKm: String(z.radiusKm),
      notes: z.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  function save() {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const radiusKm = Number(form.radiusKm);
    if (!form.name.trim()) return setError("Zone name is required.");
    if (!Number.isFinite(lat) || lat < 0 || lat > 25) return setError("Latitude must be between 0 and 25 for the Bay of Bengal.");
    if (!Number.isFinite(lng) || lng < 76 || lng > 100) return setError("Longitude must be between 76 and 100 for the Bay of Bengal.");
    if (!Number.isFinite(radiusKm) || radiusKm < 5 || radiusKm > 400) return setError("Radius must be between 5 and 400 km.");
    const payload = { ...form, lat, lng, radiusKm };
    if (editing) {
      store.updateZone(editing.id, payload);
      toast.success(`${payload.name} updated`);
    } else {
      store.addZone(payload);
      toast.success(`${payload.name} created`);
    }
    setOpen(false);
    return undefined;
  }

  return (
    <>
      <SectionHeader
        title="Security zone management"
        subtitle="Zone boundaries drive the detection engine: entering a restricted or critical zone raises a vessel's threat score."
        actions={
          <button type="button" className={btn.primary} onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add zone
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Bay of Bengal zone chart" className="xl:col-span-3" bodyClassName="p-0">
          <MapView height="h-[520px]" zones={s.zones} vessels={s.vessels} layers={{ vessels: true, incidents: false, officers: false }} />
        </Panel>
        <div className="space-y-3 xl:col-span-2">
          {s.zones.length === 0 ? (
            <Empty title="No zones configured" hint="Add a zone to start monitoring an area." />
          ) : (
            s.zones.map((z) => (
              <div key={z.id} className="glass rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{z.name}</p>
                    <p className="mono-num mt-0.5 text-[11px] text-muted-foreground">
                      {z.id} · {z.lat.toFixed(2)}°N {z.lng.toFixed(2)}°E · r {z.radiusKm} km
                    </p>
                  </div>
                  <Badge tone={statusTone(z.classification)}>{z.classification}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={statusTone(z.status)}>{z.status}</Badge>
                  <Badge tone="neutral">Priority {z.priority}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    <button type="button" className={btn.tiny} onClick={() => openEdit(z)}>
                      <MapPin className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      className={btn.tiny}
                      onClick={() => {
                        store.updateZone(z.id, { status: z.status === "active" ? "inactive" : "active" });
                        toast.success(`${z.name} ${z.status === "active" ? "deactivated" : "activated"}`);
                      }}
                    >
                      {z.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className={btn.tiny}
                      onClick={() => {
                        store.deleteZone(z.id);
                        toast.success(`${z.name} deleted`);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "Add security zone"}>
        <div className="space-y-3">
          <Field label="Zone name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Eastern Maritime Watch" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Classification">
              <select className={inputCls} value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value as ZoneClass })}>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Zone["priority"] })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Zone["status"] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Latitude">
              <input className={inputCls} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <input className={inputCls} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </Field>
            <Field label="Radius (km)">
              <input className={inputCls} value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error ? <p className="rounded-md border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className={btn.primary} onClick={save}>
              {editing ? "Save zone" : "Create zone"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
