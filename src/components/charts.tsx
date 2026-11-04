"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesRow } from "@/lib/types";

// Distinct hue AND dash pattern per line, so series stay apart without relying on colour.
const COLORS = ["#0d3b2e", "#1f6fd1", "#d9480f", "#8a4fd8", "#c2185b", "#627569"];
const DASH = [undefined, "6 4", "2 3", "10 4 2 4", "1 4", "4 2"];
const AXIS = { fontSize: 12, fill: "#4f6359", fontFamily: "var(--font-sans)" };

/** Daily % per checklist item. */
export function TrendChart({ rows, height = 280 }: { rows: SeriesRow[]; height?: number }) {
  if (rows.length === 0) return <p className="py-10 text-center text-[15px] text-stone-500">No records in this period yet.</p>;
  const labels = new Map<string, string>();
  const byDay = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    labels.set(r.code, r.label);
    const d = byDay.get(r.day) ?? { day: r.day.slice(5).split("-").reverse().join("/") };
    d[r.code] = r.pct === null ? 0 : Number(r.pct);
    byDay.set(r.day, d);
  }
  const data = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const codes = [...labels.keys()];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e9eee8" vertical={false} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: "#d3dcd4" }} minTickGap={16} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
          <Tooltip
            formatter={(v) => `${v}%`}
            contentStyle={{ borderRadius: 10, border: "1px solid #d3dcd4", fontFamily: "var(--font-sans)", fontSize: 14 }}
            labelStyle={{ fontWeight: 700, color: "#0d3b2e" }}
          />
          <Legend wrapperStyle={{ fontSize: 13, fontFamily: "var(--font-sans)", paddingTop: 8 }} iconType="plainline" />
          {codes.map((c, i) => (
            <Line key={c} type="linear" dataKey={c} name={labels.get(c)} stroke={COLORS[i % COLORS.length]} strokeDasharray={DASH[i % DASH.length]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
