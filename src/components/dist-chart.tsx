import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, pctWin, type DistBin, type ReturnDistribution } from "@/lib/seasonality";

function contains(bin: DistBin, value: number) {
  return value >= bin.from && value < bin.to;
}

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DistBin }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-none">
      <div className="text-muted">{row.label}</div>
      <div className="font-mono text-base tabular-nums text-fg">{row.count.toLocaleString("zh-CN")} 次</div>
      <div className="text-xs text-faint">占全部 {pctWin(row.share)}</div>
    </div>
  );
}

export function DistChart({ dist }: { dist: ReturnDistribution }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const max = Math.max(1, ...dist.bins.map((bin) => bin.count));

  if (!ready) {
    return (
      <div className="flex h-64 items-end gap-px" aria-hidden="true">
        {dist.bins.map((bin) => (
          <div key={bin.key} className="flex h-full flex-1 items-end">
            <div
              className={bin.from >= 0 ? "w-full bg-up-dim" : "w-full bg-down-dim"}
              style={{ height: `${Math.max(bin.count > 0 ? 4 : 0, (bin.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dist.bins} margin={{ top: 12, right: 4, left: 0, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="key"
            tickFormatter={(key: string) => dist.bins.find((bin) => bin.key === key)?.tick ?? ""}
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            width={40}
            tick={{ fill: "var(--color-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--color-surface-2)" }} />
          <Bar dataKey="count" maxBarSize={18}>
            {dist.bins.map((bin) => {
              const mean = contains(bin, dist.avg);
              return (
                <Cell
                  key={bin.key}
                  fill={bin.from >= 0 ? "var(--color-up)" : "var(--color-down)"}
                  stroke={mean ? "var(--color-brass)" : "transparent"}
                  strokeWidth={mean ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function distPeak(dist: ReturnDistribution) {
  const peak = dist.bins.reduce((best, bin) => (bin.count > best.count ? bin : best), dist.bins[0]);
  if (!peak || peak.count === 0) return "这段没有样本。";
  return `最常见的是 ${peak.label}，${peak.count.toLocaleString("zh-CN")} 次，占 ${pctWin(peak.share)}。平均 ${pct(dist.avg)}，中位 ${pct(dist.median)}。`;
}
