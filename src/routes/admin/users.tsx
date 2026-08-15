import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, SectionHeader, fmtTime, statusTone } from "@/components/ms/Bits";
import { Field, Modal, TableWrap, btn, inputCls, td, th, tr } from "@/components/ms/Form";
import { ROLE_LABEL } from "@/components/ms/nav";
import { store, useMsState } from "@/lib/ms/store";
import type { Role, User } from "@/lib/ms/types";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management · MARISENTINEL Admin" },
      { name: "description", content: "Create, edit, disable and delete administrator, command officer and field officer accounts." },
      { property: "og:title", content: "User Management · MARISENTINEL" },
      { property: "og:description", content: "Role-based identity management for coastal security personnel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <UsersPage />
    </AppShell>
  ),
});

const EMPTY_FORM = {
  name: "",
  username: "",
  password: "",
  role: "field" as Role,
  region: "Bay of Bengal — East",
  status: "active" as User["status"],
};

function UsersPage() {
  const s = useMsState();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled">("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.users.filter(
      (u) =>
        (!term || u.name.toLowerCase().includes(term) || u.username.includes(term) || u.id.toLowerCase().includes(term)) &&
        (!roleFilter || u.role === roleFilter) &&
        (!statusFilter || u.status === statusFilter),
    );
  }, [s.users, q, roleFilter, statusFilter]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: u.password, role: u.role, region: u.region, status: u.status });
    setError("");
    setOpen(true);
  }

  function save() {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError("Name, username and password are required.");
      return;
    }
    const clash = s.users.find((u) => u.username === form.username.trim().toLowerCase() && u.id !== editing?.id);
    if (clash) {
      setError("That username already exists.");
      return;
    }
    const payload = { ...form, username: form.username.trim().toLowerCase() };
    if (editing) {
      store.updateUser(editing.id, payload);
      toast.success(`${payload.name} updated`);
    } else {
      store.addUser({
        ...payload,
        ...(payload.role === "field"
          ? { lat: 13.08, lng: 80.29, availability: "available" as const, currentAssignment: null }
          : {}),
      });
      toast.success(`${payload.name} created`);
    }
    setOpen(false);
  }

  return (
    <>
      <SectionHeader
        title="User management"
        subtitle={`${s.users.length} accounts across three roles.`}
        actions={
          <button type="button" className={btn.primary} onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add user
          </button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Search name, username or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}>
          <option value="">All roles</option>
          <option value="administrator">Administrator</option>
          <option value="command">Command Officer</option>
          <option value="field">Field Officer</option>
        </select>
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "disabled")}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No users match those filters" hint="Clear the search or filters to see all accounts." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>ID</th>
              <th className={th}>Role</th>
              <th className={th}>Region</th>
              <th className={th}>Status</th>
              <th className={th}>Last login</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={tr}>
                <td className={td}>
                  <span className="font-medium">{u.name}</span>
                  <span className="block text-xs text-muted-foreground">{u.username}</span>
                </td>
                <td className={`${td} mono-num text-xs`}>{u.id}</td>
                <td className={td}>
                  <Badge tone="primary">{ROLE_LABEL[u.role]}</Badge>
                </td>
                <td className={`${td} text-xs`}>{u.region}</td>
                <td className={td}>
                  <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                </td>
                <td className={`${td} text-xs text-muted-foreground`}>{u.lastLogin ? fmtTime(u.lastLogin) : "never"}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={btn.tiny} onClick={() => openEdit(u)}>
                      <UserCog className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      className={btn.tiny}
                      onClick={() => {
                        store.updateUser(u.id, { status: u.status === "active" ? "disabled" : "active" });
                        toast.success(`${u.name} ${u.status === "active" ? "disabled" : "enabled"}`);
                      }}
                    >
                      {u.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className={btn.tiny}
                      onClick={() => {
                        if (u.id === s.session?.userId) {
                          toast.error("You cannot delete the account you are signed in with.");
                          return;
                        }
                        store.deleteUser(u.id);
                        toast.success(`${u.name} deleted`);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "Add user"}>
        <div className="space-y-3">
          <Field label="Full name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Officer A. Kumar" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Username">
              <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="field6" />
            </Field>
            <Field label="Password">
              <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="field123" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="administrator">Administrator</option>
                <option value="command">Command Officer</option>
                <option value="field">Field Officer</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as User["status"] })}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </Field>
          </div>
          <Field label="Region">
            <input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          {error ? <p className="rounded-md border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className={btn.primary} onClick={save}>
              {editing ? "Save changes" : "Create user"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
