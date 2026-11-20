import { useState, type ReactNode } from "react";
import { BarChart3, CalendarDays, ChartColumn, Clock, Layers } from "lucide-react";
import { DistChart, distPeak } from "@/components/dist-chart";
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
  type DistSpan,
  type ForwardView,
  type NormCompare,
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

function sigma(z: number | null) {
  if (z == null || !Number.isFinite(z)) return "—";
  const sign = z > 0 ? "+" : "";
  return `${sign}${z.toFixed(1)}σ`;
}

function deviateWords(z: number | null) {
  if (z == null) return "样本不够，不标偏离";
  const mag = Math.abs(z);
  const dir = z > 0.05 ? "偏高" : z < -0.05 ? "偏低" : "持平";
  if (mag < 0.5) return "接近常态";
  if (mag < 1) return `略${dir}`;
  if (mag < 2) return dir;
  return `明显${dir}`;
}

function ZScale({ z }: { z: number | null }) {
  const clamped = z == null ? 0 : Math.max(-3, Math.min(3, z));
  const left = ((clamped + 3) / 6) * 100;
  return (
    <div className="relative mt-2 h-3" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
      <div className="absolute top-0 left-1/2 h-3 w-px bg-faint" />
      {z != null ? (
        <div
          className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full", z >= 0 ? "bg-up" : "bg-down")}
          style={{ left: `${left}%` }}
        />
      ) : null}
    </div>
  );
}

function NormRow({ row }: { row: NormCompare }) {
  return (
    <li className="border-t border-line py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-fg">
            {row.label}
            {row.partial ? <span className="ml-2 text-xs text-brass">未走完</span> : null}
          </p>
          <p className="text-xs text-faint">{row.detail}</p>
        </div>
        <div className="text-right">
          <p className={cn("font-mono text-xl tabular-nums", tone(row.current))}>{pct(row.current)}</p>
          <p className="text-xs text-faint">常态 {pct(row.avg)}</p>
        </div>
      </div>
      <ZScale z={row.z} />
      <p className="mt-1 text-sm text-muted">
        <span className={cn("font-mono tabular-nums", row.z == null ? "text-faint" : tone(row.z))}>{sigma(row.z)}</span>
        {" · "}
        {deviateWords(row.z)}
        {" · "}
        对照{row.norm}
        {row.n ? `，${row.n} 次，波动 ${(row.stdev * 100).toFixed(2)}%` : ""}
      </p>
      {row.also ? (
        <p className="mt-1 text-xs text-faint">
          {row.also.norm}的常态是 {pct(row.also.avg)}，相对它 {sigma(row.also.z)}（{deviateWords(row.also.z)}，{row.also.n} 次）
        </p>
      ) : null}
    </li>
  );
}

function bandText(view: ForwardView) {
  const analogs = view.analogs.toLocaleString("zh-CN");
  const pool = view.pool.toLocaleString("zh-CN");
  if (view.band === "全部") return `同一进度的历史只有 ${pool} 次，下面全部用上。`;
  if (view.band === "最近") return `没有落在 1.5σ 以内的，改用涨跌最接近的 ${analogs} 次。`;
  if (view.analogs < 8) return `只有 ${analogs} 次落在 ${view.band} 以内。样本少，下面就用这几次。`;
  if (view.band === "0.5σ") return `用了 ${analogs} 次，当时涨跌和现在相差不超过 0.5 个标准差（同类 ${pool} 次）。`;
  return `0.5σ 以内的次数不够，放宽到 ${view.band}，用了 ${analogs} 次（同类 ${pool} 次）。`;
}

function ForwardBlock({ view }: { view: ForwardView }) {
  const year = view.horizons.find((horizon) => horizon.key === "year") ?? view.horizons[view.horizons.length - 1];
  return (
    <div>
      <p className="text-sm text-fg">
        {view.progress}
        {view.partial ? <span className="ml-2 text-xs text-brass">未走完</span> : null}
        {" · "}
        现在 {pct(view.current)} · 同样进度的常态 {pct(view.avg)} ·{" "}
        <span className={cn("font-mono tabular-nums", view.z == null ? "text-faint" : tone(view.z))}>{sigma(view.z)}</span>
        {view.z != null ? `，${deviateWords(view.z)}` : ""}
      </p>
      <p className="mt-1 text-sm text-muted">{bandText(view)} 后面这几行只统计这些相近的次数。</p>
      {year && year.n > 0 ? (
        <p className="mt-2 text-sm text-fg">
          从这里起，往后约一年，最深回撤的中位数是{" "}
          <span className={cn("font-mono tabular-nums", tone(year.drawdownMedian))}>{pct(year.drawdownMedian)}</span>
          ，最深的一次是{" "}
          <span className={cn("font-mono tabular-nums", tone(year.drawdownWorst))}>{pct(year.drawdownWorst)}</span>
          （{year.n.toLocaleString("zh-CN")} 次）。没跌破起点记为 0。
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">往后一年的样本不够，看下面更短的窗口。</p>
      )}
      <ul className="mt-2">
        {view.horizons.map((horizon) => (
          <li key={horizon.key} className="border-t border-line py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-fg">
                {horizon.label}
                <span className="ml-2 text-xs text-faint">{horizon.sessions} 个交易日</span>
              </p>
              <p className={cn("font-mono text-lg tabular-nums", horizon.n ? tone(horizon.avg) : "text-muted")}>
                {horizon.n ? pct(horizon.avg) : "—"}
              </p>
            </div>
            {horizon.n ? (
              <p className="mt-1 text-sm text-muted">
                期末中位 {pct(horizon.median)} · 上涨 {pctWin(horizon.win)} · 期末最差 {pct(horizon.worst)} ·{" "}
                {horizon.n.toLocaleString("zh-CN")} 次
              </p>
            ) : (
              <p className="mt-1 text-sm text-faint">后面没有足够的交易日。</p>
            )}
            {horizon.n ? (
              <p className="mt-1 text-sm text-muted">
                从这里最深回撤，中位{" "}
                <span className={cn("font-mono tabular-nums", tone(horizon.drawdownMedian))}>{pct(horizon.drawdownMedian)}</span>
                ，最差一次{" "}
                <span className={cn("font-mono tabular-nums", tone(horizon.drawdownWorst))}>{pct(horizon.drawdownWorst)}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
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
  const [span, setSpan] = useState<DistSpan>("day");
  const [ahead, setAhead] = useState<DistSpan>("day");
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

          {data.norms?.length ? (
            <section className="mb-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-xs tracking-widest text-brass uppercase">Now</p>
              <h2 className="text-xl font-semibold text-fg">现在离常态多远</h2>
              <p className="mt-1 text-sm text-pretty text-muted">
                0 是这段历史的平均。+1σ 表示比常态高出一个标准差，-1σ 表示低一个。刻度画到 ±3σ，数字本身不截断。对照不含当前这一段。月和季比的是历年同一个月、同一个季度；日、周、年比的是全部同类样本。没走完的按已经实现的收益算，所以周期刚开始时，数字通常更靠近零。
              </p>
              <ul className="mt-2">
                {data.norms.map((row) => (
                  <NormRow key={row.key} row={row} />
                ))}
              </ul>
            </section>
          ) : null}

          {data.forward ? (
            <section className="mb-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-xs tracking-widest text-brass uppercase">After</p>
              <h2 className="text-xl font-semibold text-fg">从这里往后</h2>
              <p className="mt-1 text-sm text-pretty text-muted">
                先找历史上走到同一进度、涨跌也接近现在的那些次。再看它们之后一个交易日、一周（5 个交易日）、一月（21）、一季（63）、一年（252）的期末涨跌，以及从当时收盘往下的最深回撤。回撤只看之后的收盘，不含盘中低点。没跌破起点记为 0。这是事后分布，不是预测。
              </p>
              <div className="mt-3 mb-3 flex gap-2 overflow-x-auto">
                {(
                  [
                    ["day", "今日"],
                    ["week", "本周"],
                    ["month", "本月"],
                    ["quarter", "本季"],
                    ["year", "本年"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={ahead === key}
                    onClick={() => setAhead(key)}
                    className={cn(
                      "min-h-11 shrink-0 rounded-full border px-4 text-sm",
                      ahead === key ? "border-brass bg-brass-dim text-fg" : "border-line text-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ForwardBlock view={data.forward[ahead]} />
            </section>
          ) : null}

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
              ["#dist", "分布"],
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
            {data.dists ? (
              <section id="dist" className="scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
                <div className="mb-4 flex items-start gap-3">
                  <span className="mt-0.5 text-brass" aria-hidden="true">
                    <ChartColumn className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-xs tracking-widest text-brass uppercase">Distribution</p>
                    <h2 className="text-xl font-semibold text-fg">涨跌落在哪一档</h2>
                    <p className="mt-1 text-sm text-pretty text-muted">
                      横轴是这段时间涨了或跌了多少，柱子是有多少次落在这一档。每日是收盘对收盘。每周、每月、每季、每年把这一段里的交易日连乘。没走完的周、月、季、年按已经实现的收益算。描金边的那一档是平均数落点。
                    </p>
                  </div>
                </div>
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {(
                    [
                      ["day", "每日"],
                      ["week", "每周"],
                      ["month", "每月"],
                      ["quarter", "每季"],
                      ["year", "每年"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={span === key}
                      onClick={() => setSpan(key)}
                      className={cn(
                        "min-h-11 shrink-0 rounded-full border px-4 text-sm",
                        span === key ? "border-brass bg-brass-dim text-fg" : "border-line text-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-sm text-fg">
                  {data.dists[span].n.toLocaleString("zh-CN")} 次 · 平均 {pct(data.dists[span].avg)} · 中位{" "}
                  {pct(data.dists[span].median)} · 上涨 {pctWin(data.dists[span].win)} · 波动{" "}
                  {(Math.abs(data.dists[span].stdev) * 100).toFixed(2)}%
                </p>
                <p className="mb-2 text-sm text-muted">{distPeak(data.dists[span])}</p>
                <DistChart dist={data.dists[span]} />
                <p className="mt-2 text-xs text-faint">
                  两端是超出坐标的尾巴。每日 ±4%，每周 ±8%，每月 ±12%，每季 ±20%，每年 ±40%。最好 {pct(data.dists[span].best)}，最差{" "}
                  {pct(data.dists[span].worst)}。
                </p>
              </section>
            ) : null}

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
