import { useState, type ReactNode } from "react";
import { BarChart3, CalendarDays, Clock, Layers } from "lucide-react";
import { MonthHeatmap } from "@/components/month-heatmap";
import { ReturnChart } from "@/components/return-chart";
import { loadSeasonality } from "@/lib/market.functions";
import {
  INDICES,
  WINDOWS,
  extremes,
  fmtPx,
  pct,
  pctWin,
  type BucketStat,
  type SeasonalityData,
} from "@/lib/seasonality";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function tone(value: number) {
  if (value > 0.0000001) return "text-up";
  if (value < -0.0000001) return "text-down";
  return "text-muted";
}

function weekdayLabel(key: string) {
  const found = { Mon: "周一", Tue: "周二", Wed: "周三", Thu: "周四", Fri: "周五", Sat: "周六", Sun: "周日" }[key];
  return found ?? key;
}

function readExtremes(stats: BucketStat[]) {
  const ends = extremes(stats);
  if (!ends) return "样本还不够。";
  return `${ends.best.label}平均 ${pct(ends.best.avg)}，胜率 ${pctWin(ends.best.win)}；${ends.worst.label}平均 ${pct(ends.worst.avg)}，胜率 ${pctWin(ends.worst.win)}。`;
}

function StatRows({ stats, highlight }: { stats: BucketStat[]; highlight?: string | null }) {
  return (
    <ul className="divide-y divide-line border-t border-line">
      {stats.map((stat) => {
        const on = stat.key === highlight;
        return (
          <li
            key={stat.key}
            className={cn(
              "flex flex-col gap-2 border-line py-3 sm:flex-row sm:items-start sm:justify-between",
              on && "rounded-lg bg-brass-dim px-3",
            )}
          >
            <div className="flex items-baseline justify-between gap-3 sm:block sm:w-36">
              <div className={cn("text-sm", on ? "text-brass" : "text-fg")}>
                {stat.label}
                {on ? <span className="ml-2 text-xs text-brass">当前</span> : null}
              </div>
              <div className={cn("font-mono text-xl tabular-nums sm:mt-1", tone(stat.avg))}>
                {stat.n ? pct(stat.avg) : "—"}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
              <div>
                <dt className="text-xs text-faint">中位</dt>
                <dd className={cn("font-mono tabular-nums", tone(stat.median))}>{stat.n ? pct(stat.median) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">上涨概率</dt>
                <dd className="font-mono tabular-nums text-fg">{stat.n ? pctWin(stat.win) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">样本</dt>
                <dd className="font-mono tabular-nums text-fg">{stat.n ? `${stat.n} 次` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">最好</dt>
                <dd className={cn("font-mono tabular-nums", tone(stat.best))}>{stat.n ? pct(stat.best) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">最差</dt>
                <dd className={cn("font-mono tabular-nums", tone(stat.worst))}>{stat.n ? pct(stat.worst) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">只做这段的复利</dt>
                <dd className={cn("font-mono tabular-nums", tone(stat.compounded))}>{stat.n ? pct(stat.compounded) : "—"}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  id,
  kicker,
  title,
  note,
  icon,
  stats,
  highlight,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  note: string;
  icon: ReactNode;
  stats: BucketStat[];
  highlight?: string | null;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 text-brass" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-serif text-xs tracking-widest text-brass uppercase">{kicker}</p>
          <h2 className="text-xl font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-sm text-pretty text-muted">{note}</p>
          <p className="mt-2 text-sm text-fg">{readExtremes(stats)}</p>
        </div>
      </div>
      <ReturnChart stats={stats} highlight={highlight} />
      {children}
      <StatRows stats={stats} highlight={highlight} />
    </section>
  );
}

function NowCard({
  label,
  title,
  avg,
  win,
  extra,
}: {
  label: string;
  title: string;
  avg: number | null;
  win: number | null;
  extra: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-faint">{label}</p>
      <h3 className="mt-1 text-lg font-semibold">{title}</h3>
      <p className={cn("mt-2 font-mono text-3xl tabular-nums", avg == null ? "text-muted" : tone(avg))}>
        {avg == null ? "—" : pct(avg)}
      </p>
      <p className="mt-1 text-sm text-muted">{win == null ? "没有样本" : `历史上涨 ${pctWin(win)}`}</p>
      <p className="mt-2 text-sm text-pretty text-faint">{extra}</p>
    </article>
  );
}

export function SeasonDesk({
  initial,
  initialError,
}: {
  initial: SeasonalityData | null;
  initialError: string | null;
}) {
  const [symbol, setSymbol] = useState<string>(initial?.symbol ?? "^GSPC");
  const [years, setYears] = useState(initial?.years ?? 30);
  const [data, setData] = useState<SeasonalityData | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function choose(nextSymbol: string, nextYears: number) {
    setSymbol(nextSymbol);
    setYears(nextYears);
    setPending(true);
    setError(null);
    try {
      const result = await loadSeasonality({ data: { symbol: nextSymbol, years: nextYears } });
      if (!result.ok) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch {
      setError("行情暂时取不到，过一会儿再试。");
    } finally {
      setPending(false);
    }
  }

  const monthStat = data?.months.find((stat) => stat.key === String(data.calendar.month)) ?? null;
  const quarterStat = data?.quarters.find((stat) => stat.key === String(data.calendar.quarter)) ?? null;
  const weekdayStat = data?.weekdays.find((stat) => stat.key === data.calendar.weekday) ?? null;
  const runningMonth = data?.monthCells.find((cell) => {
    const year = Number(data.calendar.iso.slice(0, 4));
    return cell.year === year && cell.month === data.calendar.month;
  });

  const monthEnds = data ? extremes(data.months) : null;
  const quarterEnds = data ? extremes(data.quarters) : null;
  const dayEnds = data ? extremes(data.weekdays) : null;
  const hourEnds = data ? extremes(data.hours) : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6">
        <p className="font-serif text-xs tracking-widest text-brass">SEASON TAPE</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">季律</h1>
            <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
              美股指数按月份、季度、星期和盘中小时拆开。看的是历史上这段时间平均怎么走，不是下一笔该不该下。
            </p>
          </div>
          {data ? (
            <div className="text-left sm:text-right">
              <p className="text-xs text-faint">
                {data.short} · {data.note} · 收于 {data.lastDate}
              </p>
              <p className="font-mono text-2xl tabular-nums">{fmtPx(data.last)}</p>
              <p className={cn("font-mono text-sm tabular-nums", tone(data.dayChange))}>
                上一交易日 {pct(data.dayChange)}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {INDICES.map((item) => {
            const on = item.symbol === symbol;
            return (
              <button
                key={item.symbol}
                type="button"
                disabled={pending}
                onClick={() => choose(item.symbol, years)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm",
                  on ? "border-brass bg-brass text-bg" : "border-line bg-surface text-fg",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {WINDOWS.map((item) => {
            const on = item.years === years;
            return (
              <button
                key={item.label}
                type="button"
                disabled={pending}
                onClick={() => choose(symbol, item.years)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm",
                  on ? "border-brass bg-brass-dim text-brass" : "border-line bg-surface text-muted",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-down bg-down-dim px-4 py-3 text-sm text-fg" role="alert">
          {error}
        </p>
      ) : null}

      {!data ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-8 text-sm text-muted">
          {error ? "上面这条是行情源的回复。" : "正在取近几十年的日线，第一次会稍慢。"}
          <div className="mt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => choose(symbol, years)}
              className="min-h-11 rounded-full bg-brass px-4 text-sm text-bg"
            >
              {pending ? "取数中" : "再试一次"}
            </button>
          </div>
        </div>
      ) : (
        <div className={cn(pending && "opacity-60")}>
          <p className="mb-4 text-sm text-muted">
            {data.name} · {data.fromYear}–{data.toYear} · {data.sampleDays.toLocaleString("zh-CN")} 个交易日
            {pending ? " · 更新中" : ""}
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <NowCard
              label="这个月"
              title={monthStat?.label ?? "—"}
              avg={monthStat?.avg ?? null}
              win={monthStat?.win ?? null}
              extra={
                runningMonth
                  ? `今年走到现在 ${pct(runningMonth.ret)}。未结束的月份按已实现收益算。`
                  : "这个月还没有收盘样本。"
              }
            />
            <NowCard
              label="这个季度"
              title={quarterStat?.label ?? "—"}
              avg={quarterStat?.avg ?? null}
              win={quarterStat?.win ?? null}
              extra="季度收益是该季三个月连乘，不是三个月平均再平均。"
            />
            <NowCard
              label="今天星期"
              title={weekdayStat?.label ?? weekdayLabel(data.calendar.weekday)}
              avg={weekdayStat?.avg ?? null}
              win={weekdayStat?.win ?? null}
              extra={`最近交易日是${weekdayLabel(data.lastSession.weekday)}（${data.lastSession.iso}）${pct(data.lastSession.ret)}。周一含周末跳空。`}
            />
          </div>

          {(monthEnds || quarterEnds || dayEnds || hourEnds) && (
            <aside className="mb-6 rounded-2xl border border-brass bg-brass-dim px-4 py-4 text-sm text-pretty">
              <p className="mb-1 text-xs tracking-wide text-brass">这段历史里，更常涨的是</p>
              <p>
                {monthEnds ? `${monthEnds.best.label}强于其他月份，${monthEnds.worst.label}最弱。` : ""}
                {quarterEnds ? `${quarterEnds.best.label}是四个季度里平均最好的。` : ""}
                {dayEnds ? `星期里${dayEnds.best.label}平均最高，${dayEnds.worst.label}最低。` : ""}
                {hourEnds && data.hourRange
                  ? `盘中（${data.hourRange.from} 至 ${data.hourRange.to}）${hourEnds.best.label} 这段平均最好，${hourEnds.worst.label}最差。`
                  : ""}
              </p>
            </aside>
          )}

          <nav className="mb-4 flex gap-2 overflow-x-auto text-sm">
            {[
              ["#months", "月份"],
              ["#quarters", "季度"],
              ["#weekdays", "星期"],
              ["#hours", "小时"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="min-h-11 shrink-0 rounded-full border border-line px-4 py-2 text-muted">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            <Section
              id="months"
              kicker="Month"
              title="一到十二月"
              note="每月收益是该月所有交易日收盘对收盘连乘。一月的第一天含跨年跳空。"
              icon={<CalendarDays className="size-5" />}
              stats={data.months}
              highlight={String(data.calendar.month)}
            >
              <div className="mt-4 mb-2">
                <MonthHeatmap cells={data.monthCells} />
              </div>
            </Section>

            <Section
              id="quarters"
              kicker="Quarter"
              title="四个季度"
              note="一季度是 1–3 月，二季度 4–6 月，三季度 7–9 月，四季度 10–12 月。没走完的季度只含已实现的月份。"
              icon={<Layers className="size-5" />}
              stats={data.quarters}
              highlight={String(data.calendar.quarter)}
            />

            <Section
              id="weekdays"
              kicker="Weekday"
              title="周一到周五"
              note="按收盘日归类。周一的数字是周五收盘到周一收盘，周末和假期跳空都算在周一。"
              icon={<BarChart3 className="size-5" />}
              stats={data.weekdays}
              highlight={data.calendar.weekday}
            />

            <Section
              id="hours"
              kicker="Hour"
              title="盘中，从 9:30 一小时一小时往后"
              note={
                data.hourRange
                  ? `每段用这一小时自己的开盘到收盘，不含隔夜。最后一段只有半小时（15:30–16:00）。Yahoo 一小时线大约只能看近两年：${data.hourRange.from} 至 ${data.hourRange.to}，${data.hourRange.sessions} 个交易日。年份窗口再长，小时也不会超出这段。`
                  : "这次没有取到小时线。"
              }
              icon={<Clock className="size-5" />}
              stats={data.hours}
              highlight={data.calendar.hourKey}
            />
          </div>

          <footer className="mt-8 text-sm text-pretty text-faint">
            价格来自 Yahoo Finance，时区是纽约。平均是算术平均，复利是「每年只持有这一段」连乘后的总涨跌。样本往往只有几十次，一个崩盘月就能把平均值拉歪。这是对照节奏用的，不是交易信号。
            <button type="button" className="ml-2 text-brass underline" onClick={() => choose(symbol, years)}>
              重新计算
            </button>
          </footer>
        </div>
      )}
    </main>
  );
}
