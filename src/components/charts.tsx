"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesRow } from "@/lib/types";

const COLORS = ["#217c44", "#0e8f99", "#f5b700", "#a855f7", "#e11d48", "#64748b"];

/** Daily % per checklist item. */
export function TrendChart({ rows, height = 280 }: { rows: SeriesRow[]; height?: number }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-stone-500">No records in this period yet.</p>;
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
          <CartesianGrid stroke="#e7ebe4" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {codes.map((c, i) => (
            <Line key={c} type="linear" dataKey={c} name={labels.get(c)} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
