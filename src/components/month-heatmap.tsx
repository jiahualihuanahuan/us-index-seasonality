import { useMemo, useState } from "react";
import { MONTHS_SHORT, pct, type MonthCell } from "@/lib/seasonality";

const SCALE = 0.06;

export function MonthHeatmap({ cells }: { cells: MonthCell[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const years = useMemo(() => {
    const set = new Set(cells.map((cell) => cell.year));
    return [...set].sort((a, b) => b - a);
  }, [cells]);
  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) map.set(`${cell.year}-${cell.month}`, cell.ret);
    return map;
  }, [cells]);

  const selectedKey = picked ?? (years[0] ? `${years[0]}-${cells.find((cell) => cell.year === years[0])?.month ?? 1}` : null);
  const selectedRet = selectedKey ? lookup.get(selectedKey) : undefined;
  const [selectedYear, selectedMonth] = selectedKey?.split("-").map(Number) ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-faint">
        <span>每年每个月的实际涨跌</span>
        <span className="flex items-center gap-2">
          <span className="heat-down inline-block h-3 w-6 rounded-sm" style={{ ["--t" as string]: "0.85" }} />
          跌
          <span className="heat-flat inline-block h-3 w-6 rounded-sm" />
          <span className="heat-up inline-block h-3 w-6 rounded-sm" style={{ ["--t" as string]: "0.85" }} />
          涨
        </span>
      </div>
      <div className="max-h-96 overflow-auto rounded-xl border border-line">
        <div className="sticky top-0 z-10 grid grid-cols-[3.2rem_repeat(12,minmax(0,1fr))] gap-1 bg-surface px-2 py-2 text-center text-xs text-faint">
          <span />
          {MONTHS_SHORT.map((label) => (
            <span key={label}>{label.replace("月", "")}</span>
          ))}
        </div>
        <div className="flex flex-col gap-1 px-2 pb-2">
          {years.map((year) => (
            <div key={year} className="grid grid-cols-[3.2rem_repeat(12,minmax(0,1fr))] gap-1">
              <span className="self-center font-mono text-xs tabular-nums text-faint">{year}</span>
              {MONTHS_SHORT.map((_, index) => {
                const month = index + 1;
                const key = `${year}-${month}`;
                const ret = lookup.get(key);
                const on = selectedKey === key;
                if (ret == null) {
                  return <span key={key} className="h-7 rounded-sm bg-bg" />;
                }
                const intensity = Math.min(1, Math.abs(ret) / SCALE);
                const klass = Math.abs(ret) < 0.0005 ? "heat-flat" : ret > 0 ? "heat-up" : "heat-down";
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`${year}年${month}月 ${pct(ret)}`}
                    className={`h-7 min-w-0 rounded-sm ${klass} ${on ? "heat-on" : ""}`}
                    style={{ ["--t" as string]: String(intensity) }}
                    onClick={() => setPicked(key)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 font-mono text-sm tabular-nums text-fg">
        {selectedYear && selectedMonth ? (
          <>
            {selectedYear} 年 {selectedMonth} 月{" "}
            <span className={selectedRet != null && selectedRet >= 0 ? "text-up" : "text-down"}>
              {selectedRet == null ? "—" : pct(selectedRet)}
            </span>
          </>
        ) : (
          "点一个格子看那个月"
        )}
      </p>
    </div>
  );
}
