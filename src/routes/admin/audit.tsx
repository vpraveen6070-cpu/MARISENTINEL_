import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/ms/AppShell";
import { Badge, Empty, SectionHeader, fmtTime } from "@/components/ms/Bits";
import { TableWrap, inputCls, td, th, tr } from "@/components/ms/Form";
import { useMsState } from "@/lib/ms/store";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · MARISENTINEL Admin" },
      { name: "description", content: "Searchable audit trail of every login, configuration change, alert confirmation and field report." },
      { property: "og:title", content: "Audit Log · MARISENTINEL" },
      { property: "og:description", content: "Full traceability of operator actions across the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell role="administrator">
      <AuditPage />
    </AppShell>
  ),
});

function AuditPage() {
  const s = useMsState();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const cats = useMemo(() => Array.from(new Set(s.audit.map((a) => a.module))).sort(), [s.audit]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.audit.filter(
      (a) =>
        (!term || a.action.toLowerCase().includes(term) || a.user.toLowerCase().includes(term)) &&
        (!cat || a.module === cat),
    );
  }, [s.audit, q, cat]);

  return (
    <>
      <SectionHeader title="Audit log" subtitle={`${s.audit.length} recorded actions. Newest first.`} />
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input className={inputCls} placeholder="Search action or actor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <Empty title="No audit entries match" hint="Adjust the search or category filter." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Timestamp</th>
              <th className={th}>Actor</th>
              <th className={th}>Category</th>
              <th className={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={tr}>
                <td className={`${td} mono-num whitespace-nowrap text-xs text-muted-foreground`}>{fmtTime(a.ts)}</td>
                <td className={`${td} text-xs font-medium`}>{a.user}</td>
                <td className={td}>
                  <Badge tone="neutral">{a.module}</Badge>
                </td>
                <td className={`${td} text-sm`}>{a.action}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
