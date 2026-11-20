import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BucketStat } from "@/lib/seasonality";
import { pct } from "@/lib/seasonality";

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: BucketStat }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const value = payload[0]?.value;
  if (value == null || !row) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-none">
      <div className="text-muted">{label}</div>
      <div className="font-mono text-base tabular-nums text-fg">{pct(value)}</div>
      <div className="text-xs text-faint">
        胜率 {Math.round(row.win * 100)}% · {row.n} 次
      </div>
    </div>
  );
}

export function ReturnChart({ stats, highlight }: { stats: BucketStat[]; highlight?: string | null }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const max = Math.max(0.004, ...stats.map((stat) => Math.abs(stat.avg)));

  if (!ready) {
    return (
      <div className="flex h-56 items-end gap-2 px-2" aria-hidden="true">
        {stats.map((stat) => (
          <div key={stat.key} className="flex h-full flex-1 items-end">
            <div
              className={stat.avg >= 0 ? "w-full rounded-t bg-up-dim" : "w-full rounded-t bg-down-dim"}
              style={{ height: `${Math.max(8, (Math.abs(stat.avg) / max) * 78)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="short"
            tick={{ fill: "var(--color-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(value: number) => `${(value * 100).toFixed(1)}%`}
            width={48}
            tick={{ fill: "var(--color-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke="var(--color-faint)" />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--color-surface-2)" }} />
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={42}>
            {stats.map((stat) => (
              <Cell
                key={stat.key}
                fill={stat.avg >= 0 ? "var(--color-up)" : "var(--color-down)"}
                stroke={stat.key === highlight ? "var(--color-brass)" : "transparent"}
                strokeWidth={stat.key === highlight ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
