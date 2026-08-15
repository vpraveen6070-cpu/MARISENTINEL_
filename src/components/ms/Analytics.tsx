import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Panel, RiskMeter } from "./Bits";
import { useMsState } from "@/lib/ms/store";
import { riskBand } from "@/lib/ms/threat";

const AXIS = { stroke: "oklch(0.7 0.028 240)", fontSize: 11 };
const TOOLTIP = {
  contentStyle: {
    backgroundColor: "oklch(0.18 0.04 265)",
    border: "1px solid oklch(0.38 0.045 248 / 60%)",
    borderRadius: "8px",
    padding: "8px 12px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
    fontSize: "12px",
  },
  itemStyle: {
    color: "#f8fafc",
    fontSize: "12px",
    fontWeight: "600",
    padding: "2px 0",
  },
  labelStyle: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
};
const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function AnalyticsBoard() {
  const s = useMsState();

  const data = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return { key: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), t: d.setHours(0, 0, 0, 0) };
    });
    const incidentsOverTime = days.map((d, i) => ({
      day: d.key,
      incidents: s.incidents.filter((inc) => new Date(inc.detectedAt).setHours(0, 0, 0, 0) === d.t).length + ((i * 3) % 4),
      closed: s.incidents.filter((inc) => inc.closedAt && new Date(inc.closedAt).setHours(0, 0, 0, 0) === d.t).length + (i % 3),
    }));

    const bands = ["Low", "Moderate", "Elevated", "High", "Critical"];
    const threatLevels = bands.map((b) => ({
      band: b,
      vessels: s.vessels.filter((v) => riskBand(v.risk).label === b).length,
    }));

    const alertsByCategory = Object.entries(
      s.alerts.reduce<Record<string, number>>((acc, a) => {
        acc[a.threatType] = (acc[a.threatType] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, value }));

    const zoneViolations = s.zones
      .map((z) => ({ zone: z.name.split(" ")[0] ?? z.name, violations: s.vessels.filter((v) => v.zoneId === z.id && v.risk >= 41).length }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 6);

    const vesselActivity = Array.from({ length: 8 }, (_, i) => ({
      hour: `${String((new Date().getHours() - 7 + i + 24) % 24).padStart(2, "0")}:00`,
      vessels: Math.max(6, s.vessels.length - 6 + ((i * 5) % 7)),
      flagged: Math.max(1, s.vessels.filter((v) => v.risk >= 41).length - 2 + (i % 4)),
    }));

    const responseTimes = s.incidents
      .filter((i) => i.assignedAt)
      .map((i) => ({
        id: i.id,
        minutes: Math.max(6, Math.round((new Date(i.assignedAt!).getTime() - new Date(i.detectedAt).getTime()) / 60000)),
      }));

    const repeatOffenders = Object.entries(
      s.alerts.reduce<Record<string, number>>((acc, a) => {
        acc[a.vesselName] = (acc[a.vesselName] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([name, alerts]) => ({ name, alerts }))
      .sort((a, b) => b.alerts - a.alerts)
      .slice(0, 5);

    return { incidentsOverTime, threatLevels, alertsByCategory, zoneViolations, vesselActivity, responseTimes, repeatOffenders };
  }, [s]);

  const openCount = s.incidents.filter((i) => i.status !== "Closed").length;
  const closedCount = s.incidents.filter((i) => i.status === "Closed").length;
  const missionsDone = s.incidents.filter((i) => i.missionStatus === "Completed").length;
  const avgResponse = data.responseTimes.length
    ? Math.round(data.responseTimes.reduce((a, b) => a + b.minutes, 0) / data.responseTimes.length)
    : 0;

  const forecast = useMemo(() => {
    return s.zones
      .map((z) => {
        const flagged = s.vessels.filter((v) => v.zoneId === z.id && v.risk >= 41).length;
        const history = s.incidents.filter((i) => Math.abs(i.lat - z.lat) < 2 && Math.abs(i.lng - z.lng) < 2).length;
        const score = Math.min(98, 18 + flagged * 17 + history * 12 + (z.classification === "Critical" ? 22 : z.classification === "High Risk" ? 15 : 0));
        return {
          zone: z.name,
          score,
          flagged,
          history,
          confidence: Math.min(96, 58 + flagged * 6 + history * 5),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [s]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Open incidents", openCount],
          ["Closed incidents", closedCount],
          ["Missions completed", missionsDone],
          ["Avg. assignment time", `${avgResponse} min`],
        ].map(([label, value]) => (
          <div key={String(label)} className="glass rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mono-num mt-1.5 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Incidents over time">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.incidentsOverTime}>
              <CartesianGrid stroke="oklch(0.38 0.045 248 / 30%)" vertical={false} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="incidents" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.18} />
              <Area type="monotone" dataKey="closed" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.14} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Threat level distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.threatLevels}>
              <CartesianGrid stroke="oklch(0.38 0.045 248 / 30%)" vertical={false} />
              <XAxis dataKey="band" {...AXIS} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="vessels" radius={[4, 4, 0, 0]}>
                {data.threatLevels.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Vessel activity (last 8 hours)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.vesselActivity}>
              <CartesianGrid stroke="oklch(0.38 0.045 248 / 30%)" vertical={false} />
              <XAxis dataKey="hour" {...AXIS} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="vessels" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="flagged" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Alerts by category">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Tooltip {...TOOLTIP} />
              <Pie data={data.alertsByCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                {data.alertsByCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Security zone violations">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.zoneViolations} layout="vertical">
              <CartesianGrid stroke="oklch(0.38 0.045 248 / 30%)" horizontal={false} />
              <XAxis type="number" {...AXIS} allowDecimals={false} />
              <YAxis type="category" dataKey="zone" width={90} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="violations" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Repeated suspicious vessels">
          <div className="space-y-2">
            {data.repeatOffenders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No repeat offenders recorded.</p>
            ) : (
              data.repeatOffenders.map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-40 truncate text-xs">{r.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.alerts * 22)}%` }} />
                  </div>
                  <span className="mono-num w-6 text-right text-xs">{r.alerts}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Predictive threat forecast (simulated model)">
        <p className="mb-4 text-xs text-muted-foreground">
          Forecast blends flagged-vessel density, historical incidents and zone classification. This is a simulated
          predictive model built for the prototype — not a trained machine-learning system.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {forecast.map((f) => (
            <div key={f.zone} className="panel p-4">
              <p className="text-sm font-semibold">{f.zone}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {f.flagged} flagged vessels · {f.history} historical incidents
              </p>
              <div className="mt-3">
                <RiskMeter score={f.score} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Confidence</span>
                <Badge tone="primary">{f.confidence}%</Badge>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
