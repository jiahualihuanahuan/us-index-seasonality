export const INDICES = [
  { symbol: "^GSPC", name: "标普 500", short: "SPX", note: "大盘" },
  { symbol: "^NDX", name: "纳指 100", short: "NDX", note: "大科技" },
  { symbol: "^IXIC", name: "纳斯达克", short: "COMP", note: "综合" },
  { symbol: "^DJI", name: "道琼斯", short: "DJI", note: "蓝筹" },
  { symbol: "^RUT", name: "罗素 2000", short: "RUT", note: "小盘" },
] as const;

export type IndexSymbol = (typeof INDICES)[number]["symbol"];

export const WINDOWS = [
  { years: 10, label: "10 年" },
  { years: 20, label: "20 年" },
  { years: 30, label: "30 年" },
  { years: 50, label: "50 年" },
  { years: 0, label: "全部" },
] as const;

export const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
export const MONTHS_SHORT = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
export const QUARTERS = ["一季度", "二季度", "三季度", "四季度"];
export const WEEKDAYS = [
  { key: "Mon", label: "周一" },
  { key: "Tue", label: "周二" },
  { key: "Wed", label: "周三" },
  { key: "Thu", label: "周四" },
  { key: "Fri", label: "周五" },
] as const;

export const HOURS = [
  { key: "09:30", label: "9:30–10:30" },
  { key: "10:30", label: "10:30–11:30" },
  { key: "11:30", label: "11:30–12:30" },
  { key: "12:30", label: "12:30–13:30" },
  { key: "13:30", label: "13:30–14:30" },
  { key: "14:30", label: "14:30–15:30" },
  { key: "15:30", label: "15:30–16:00" },
] as const;

export type BucketStat = {
  key: string;
  label: string;
  short: string;
  n: number;
  avg: number;
  median: number;
  win: number;
  best: number;
  worst: number;
  compounded: number;
  stdev: number;
};

export type MonthCell = { year: number; month: number; ret: number };

export type DistBin = {
  key: string;
  label: string;
  tick: string;
  count: number;
  share: number;
  from: number;
  to: number;
};

export type DistSpan = "day" | "week" | "month" | "quarter" | "year";

export type ReturnDistribution = {
  key: DistSpan;
  label: string;
  n: number;
  avg: number;
  median: number;
  stdev: number;
  win: number;
  best: number;
  worst: number;
  bins: DistBin[];
};

export type NormCompare = {
  key: DistSpan;
  label: string;
  detail: string;
  norm: string;
  current: number;
  avg: number;
  stdev: number;
  z: number | null;
  n: number;
  partial: boolean;
  also: { norm: string; avg: number; stdev: number; z: number | null; n: number } | null;
};

export type ForwardHorizon = {
  key: DistSpan;
  label: string;
  sessions: number;
  n: number;
  avg: number;
  median: number;
  win: number;
  worst: number;
  drawdownMedian: number;
  drawdownWorst: number;
};

export type ForwardView = {
  key: DistSpan;
  label: string;
  progress: string;
  current: number;
  avg: number;
  stdev: number;
  z: number | null;
  pool: number;
  analogs: number;
  band: "0.5σ" | "1σ" | "1.5σ" | "最近" | "全部";
  partial: boolean;
  horizons: ForwardHorizon[];
};

export type SeasonalityData = {
  ok: true;
  symbol: IndexSymbol;
  name: string;
  short: string;
  note: string;
  last: number;
  dayChange: number;
  firstDate: string;
  lastDate: string;
  fromYear: number;
  toYear: number;
  years: number;
  sampleDays: number;
  months: BucketStat[];
  monthCells: MonthCell[];
  quarters: BucketStat[];
  weekdays: BucketStat[];
  hours: BucketStat[];
  dists: Record<DistSpan, ReturnDistribution>;
  norms: NormCompare[];
  forward: Record<DistSpan, ForwardView>;
  hourRange: { from: string; to: string; sessions: number } | null;
  calendar: {
    iso: string;
    month: number;
    quarter: number;
    weekday: string;
    hourKey: string | null;
  };
  lastSession: {
    iso: string;
    weekday: string;
    month: number;
    ret: number;
  };
};

export type SeasonalityResult = SeasonalityData | { ok: false; error: string };

export type DailyBar = { t: number; c: number };
export type HourlyBar = { t: number; o: number; c: number };

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function etParts(sec: number) {
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(sec * 1000))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hour = (map.hour ?? "00").padStart(2, "0");
  const minute = (map.minute ?? "00").padStart(2, "0");
  const month = Number(map.month);
  const year = Number(map.year);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    weekday: map.weekday ?? "",
    hour,
    minute,
    hm: `${hour}:${minute}`,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function pct(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  const abs = Math.abs(value * 100);
  const places = abs >= 100 ? 0 : abs >= 10 ? 1 : digits;
  return `${sign}${(value * 100).toFixed(places)}%`;
}

export function pctWin(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function fmtPx(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function summarize(key: string, label: string, short: string, values: number[]): BucketStat {
  if (values.length === 0) {
    return { key, label, short, n: 0, avg: 0, median: 0, win: 0, best: 0, worst: 0, compounded: 0, stdev: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const avg = values.reduce((sum, value) => sum + value, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const win = values.filter((value) => value > 0).length / n;
  let compounded = 1;
  for (const value of values) compounded *= 1 + value;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / n;
  return {
    key,
    label,
    short,
    n,
    avg,
    median,
    win,
    best: sorted[n - 1],
    worst: sorted[0],
    compounded: compounded - 1,
    stdev: Math.sqrt(variance),
  };
}

function hourKeyAt(sec: number) {
  const parts = etParts(sec);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return null;
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  if (mins < 9 * 60 + 30 || mins >= 16 * 60) return null;
  const slots = [9 * 60 + 30, 10 * 60 + 30, 11 * 60 + 30, 12 * 60 + 30, 13 * 60 + 30, 14 * 60 + 30, 15 * 60 + 30];
  let index = 0;
  for (let i = 0; i < slots.length; i += 1) {
    if (mins >= slots[i]) index = i;
  }
  return HOURS[index].key;
}

function isoWeekId(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const utcDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - utcDay);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function axisPct(value: number) {
  const points = value * 100;
  const rounded = Math.abs(points) >= 10 ? Math.round(points) : Math.round(points * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function onTick(from: number, step: number) {
  return Math.abs(from / step - Math.round(from / step)) < 1e-6;
}

function distribution(
  key: DistSpan,
  label: string,
  values: number[],
  width: number,
  limit: number,
  tickStep: number,
): ReturnDistribution {
  const stat = summarize(key, label, label, values);
  const nInner = Math.round((limit * 2) / width);
  const bins: DistBin[] = [
    {
      key: "lo",
      label: `低于 ${pct(-limit)}`,
      tick: `<${axisPct(-limit)}`,
      count: 0,
      share: 0,
      from: Number.NEGATIVE_INFINITY,
      to: -limit,
    },
  ];
  for (let i = 0; i < nInner; i += 1) {
    const from = -limit + i * width;
    const to = from + width;
    bins.push({
      key: String(i),
      label: `${pct(from)} 到 ${pct(to)}`,
      tick: onTick(from, tickStep) ? axisPct(from) : "",
      count: 0,
      share: 0,
      from,
      to,
    });
  }
  bins.push({
    key: "hi",
    label: `不低于 ${pct(limit)}`,
    tick: `≥${axisPct(limit)}`,
    count: 0,
    share: 0,
    from: limit,
    to: Number.POSITIVE_INFINITY,
  });

  for (const value of values) {
    let index = bins.length - 1;
    if (value < -limit) index = 0;
    else if (value < limit) {
      const inner = Math.floor((value + limit) / width);
      index = 1 + Math.min(nInner - 1, Math.max(0, inner));
    }
    bins[index].count += 1;
  }
  const n = values.length;
  for (const bin of bins) bin.share = n === 0 ? 0 : bin.count / n;

  return {
    key,
    label,
    n: stat.n,
    avg: stat.avg,
    median: stat.median,
    stdev: stat.stdev,
    win: stat.win,
    best: stat.best,
    worst: stat.worst,
    bins,
  };
}

function monthHasWeekdayLeft(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let next = day + 1; next <= lastDay; next += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, next)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return true;
  }
  return false;
}

function normOf(current: number, history: number[]) {
  const stat = summarize("norm", "norm", "norm", history);
  const z = stat.n >= 8 && stat.stdev > 1e-8 ? (current - stat.avg) / stat.stdev : null;
  return { avg: stat.avg, stdev: stat.stdev, z, n: stat.n };
}

const FORWARD_STEPS: Array<{ key: DistSpan; label: string; sessions: number }> = [
  { key: "day", label: "下一日", sessions: 1 },
  { key: "week", label: "下一周", sessions: 5 },
  { key: "month", label: "下一月", sessions: 21 },
  { key: "quarter", label: "下一季", sessions: 63 },
  { key: "year", label: "下一年", sessions: 252 },
];

type SessionPoint = {
  close: number;
  ret: number;
  year: number;
  month: number;
  weekKey: string;
  iso: string;
};

function periodReturn(sessions: SessionPoint[], start: number, end: number) {
  let prod = 1;
  for (let i = start; i <= end; i += 1) prod *= 1 + sessions[i].ret;
  return prod - 1;
}

function periodGroups(sessions: SessionPoint[], keyOf: (session: SessionPoint) => string) {
  const groups: Array<{ key: string; start: number; end: number }> = [];
  let start = 0;
  for (let i = 1; i <= sessions.length; i += 1) {
    if (i === sessions.length || keyOf(sessions[i]) !== keyOf(sessions[start])) {
      groups.push({ key: keyOf(sessions[start]), start, end: i - 1 });
      start = i;
    }
  }
  return groups;
}

function buildForward(
  sessions: SessionPoint[],
  partial: boolean,
  label: string,
  key: DistSpan,
  keyOf: (session: SessionPoint) => string,
  progress: (offset: number, complete: boolean) => string,
): ForwardView {
  const emptyHorizon = (step: (typeof FORWARD_STEPS)[number]): ForwardHorizon => ({
    key: step.key,
    label: step.label,
    sessions: step.sessions,
    n: 0,
    avg: 0,
    median: 0,
    win: 0,
    worst: 0,
    drawdownMedian: 0,
    drawdownWorst: 0,
  });
  if (sessions.length < 3) {
    return {
      key,
      label,
      progress: progress(0, !partial),
      current: 0,
      avg: 0,
      stdev: 0,
      z: null,
      pool: 0,
      analogs: 0,
      band: "全部",
      partial,
      horizons: FORWARD_STEPS.map(emptyHorizon),
    };
  }
  const groups = periodGroups(sessions, keyOf);
  const currentGroup = groups[groups.length - 1];
  const current = periodReturn(sessions, currentGroup.start, currentGroup.end);
  const offset = currentGroup.end - currentGroup.start;
  const points: Array<{ index: number; ret: number }> = [];
  for (const group of groups) {
    if (group.key === currentGroup.key) continue;
    const index = partial ? group.start + offset : group.end;
    if (index > group.end) continue;
    points.push({ index, ret: periodReturn(sessions, group.start, index) });
  }
  const history = points.map((point) => point.ret);
  const base = normOf(current, history);
  const within = (mult: number) =>
    points.filter((point) => base.stdev <= 1e-8 || Math.abs(point.ret - current) <= mult * base.stdev);
  let band: ForwardView["band"] = "0.5σ";
  let chosen = within(0.5);
  if (points.length < 8) {
    band = "全部";
    chosen = points;
  } else if (chosen.length < 8) {
    const one = within(1);
    const wide = within(1.5);
    if (one.length >= 8) {
      band = "1σ";
      chosen = one;
    } else if (wide.length >= 8) {
      band = "1.5σ";
      chosen = wide;
    } else if (chosen.length >= 1) {
      band = "0.5σ";
    } else if (one.length >= 1) {
      band = "1σ";
      chosen = one;
    } else if (wide.length >= 1) {
      band = "1.5σ";
      chosen = wide;
    } else {
      band = "最近";
      chosen = [...points].sort((a, b) => Math.abs(a.ret - current) - Math.abs(b.ret - current)).slice(0, 15);
    }
  }
  const horizons = FORWARD_STEPS.map((step) => {
    const rets: number[] = [];
    const drawdowns: number[] = [];
    for (const point of chosen) {
      const end = point.index + step.sessions;
      if (end >= sessions.length) continue;
      const entry = sessions[point.index].close;
      if (!(entry > 0)) continue;
      rets.push(sessions[end].close / entry - 1);
      let trough = entry;
      for (let i = point.index + 1; i <= end; i += 1) {
        if (sessions[i].close < trough) trough = sessions[i].close;
      }
      drawdowns.push(Math.min(0, trough / entry - 1));
    }
    const stat = summarize(step.key, step.label, step.label, rets);
    const pain = summarize(step.key, step.label, step.label, drawdowns);
    return {
      key: step.key,
      label: step.label,
      sessions: step.sessions,
      n: stat.n,
      avg: stat.avg,
      median: stat.median,
      win: stat.win,
      worst: stat.worst,
      drawdownMedian: pain.median,
      drawdownWorst: pain.worst,
    };
  });
  return {
    key,
    label,
    progress: progress(offset, !partial),
    current,
    avg: base.avg,
    stdev: base.stdev,
    z: base.z,
    pool: points.length,
    analogs: chosen.length,
    band,
    partial,
    horizons,
  };
}

export function indexMeta(symbol: string) {
  return INDICES.find((item) => item.symbol === symbol) ?? null;
}

export function buildSeasonality(args: {
  symbol: string;
  years: number;
  daily: DailyBar[];
  hourly: HourlyBar[];
  nowSec?: number;
}): SeasonalityResult {
  const meta = indexMeta(args.symbol);
  if (!meta) return { ok: false, error: "不认识这个指数。" };
  const years = WINDOWS.some((item) => item.years === args.years) ? args.years : 30;
  const daily = args.daily.filter((bar) => Number.isFinite(bar.c) && bar.c > 0).sort((a, b) => a.t - b.t);
  if (daily.length < 10) return { ok: false, error: "日线太短，算不出季节性。" };

  const lastParts = etParts(daily[daily.length - 1].t);
  const toYear = lastParts.year;
  const fromYear = years === 0 ? etParts(daily[0].t).year : toYear - years + 1;

  const monthAcc = new Map<string, { year: number; month: number; prod: number }>();
  const weekdayValues: Record<string, number[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
  };
  let sampleDays = 0;
  let lastRet = 0;
  const dailyRets: number[] = [];
  const weekProd = new Map<string, number>();
  const yearProd = new Map<number, number>();
  const sessions: SessionPoint[] = [];

  for (let i = 1; i < daily.length; i += 1) {
    const parts = etParts(daily[i].t);
    if (parts.weekday === "Sat" || parts.weekday === "Sun") continue;
    const ret = daily[i].c / daily[i - 1].c - 1;
    if (!Number.isFinite(ret)) continue;
    if (parts.year < fromYear) continue;
    sampleDays += 1;
    lastRet = ret;
    dailyRets.push(ret);
    if (weekdayValues[parts.weekday]) weekdayValues[parts.weekday].push(ret);
    const weekKey = isoWeekId(parts.year, parts.month, parts.day);
    weekProd.set(weekKey, (weekProd.get(weekKey) ?? 1) * (1 + ret));
    yearProd.set(parts.year, (yearProd.get(parts.year) ?? 1) * (1 + ret));
    const key = `${parts.year}-${parts.month}`;
    const acc = monthAcc.get(key) ?? { year: parts.year, month: parts.month, prod: 1 };
    acc.prod *= 1 + ret;
    monthAcc.set(key, acc);
    sessions.push({
      close: daily[i].c,
      ret,
      year: parts.year,
      month: parts.month,
      weekKey,
      iso: parts.iso,
    });
  }

  const monthCells: MonthCell[] = [...monthAcc.values()]
    .map((cell) => ({ year: cell.year, month: cell.month, ret: cell.prod - 1 }))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const monthBuckets = MONTHS.map((_, index) => {
    const month = index + 1;
    return monthCells.filter((cell) => cell.month === month).map((cell) => cell.ret);
  });

  const quarterValues: number[][] = [[], [], [], []];
  const quarterAcc = new Map<string, { quarter: number; prod: number }>();
  for (const cell of monthCells) {
    const quarter = Math.floor((cell.month - 1) / 3);
    const key = `${cell.year}-${quarter}`;
    const acc = quarterAcc.get(key) ?? { quarter, prod: 1 };
    acc.prod *= 1 + cell.ret;
    quarterAcc.set(key, acc);
  }
  for (const acc of quarterAcc.values()) quarterValues[acc.quarter].push(acc.prod - 1);

  const weekRets = [...weekProd.values()].map((prod) => prod - 1);
  const yearRets = [...yearProd.values()].map((prod) => prod - 1);
  const monthRets = monthCells.map((cell) => cell.ret);
  const quarterRets = quarterValues.flat();
  const dists: Record<DistSpan, ReturnDistribution> = {
    day: distribution("day", "每日", dailyRets, 0.0025, 0.04, 0.01),
    week: distribution("week", "每周", weekRets, 0.005, 0.08, 0.02),
    month: distribution("month", "每月", monthRets, 0.01, 0.12, 0.04),
    quarter: distribution("quarter", "每季", quarterRets, 0.02, 0.2, 0.1),
    year: distribution("year", "每年", yearRets, 0.05, 0.4, 0.1),
  };

  const weekdayZh: Record<string, string> = { Mon: "周一", Tue: "周二", Wed: "周三", Thu: "周四", Fri: "周五" };
  const currentWeekKey = isoWeekId(lastParts.year, lastParts.month, lastParts.day);
  const currentQuarter = Math.floor((lastParts.month - 1) / 3);
  const monthOpen = monthHasWeekdayLeft(lastParts.year, lastParts.month, lastParts.day);
  const weekOpen = lastParts.weekday !== "Fri";
  const quarterOpen = currentQuarter < 3 ? true : monthOpen;
  const yearOpen = lastParts.month < 12 || monthOpen;
  const currentMonthRet = monthCells.find((cell) => cell.year === lastParts.year && cell.month === lastParts.month)?.ret ?? lastRet;
  let currentQuarterRet = 0;
  const priorSameQuarter: number[] = [];
  for (const [key, acc] of quarterAcc) {
    const ret = acc.prod - 1;
    const [yearText, quarterText] = key.split("-");
    if (Number(yearText) === lastParts.year && Number(quarterText) === currentQuarter) currentQuarterRet = ret;
    else if (Number(quarterText) === currentQuarter) priorSameQuarter.push(ret);
  }
  const dayNorm = normOf(lastRet, dailyRets.slice(0, -1));
  const weekNorm = normOf(
    (weekProd.get(currentWeekKey) ?? 1) - 1,
    [...weekProd.entries()].filter(([key]) => key !== currentWeekKey).map(([, prod]) => prod - 1),
  );
  const monthNorm = normOf(
    currentMonthRet,
    monthCells.filter((cell) => cell.month === lastParts.month && cell.year !== lastParts.year).map((cell) => cell.ret),
  );
  const quarterNorm = normOf(currentQuarterRet, priorSameQuarter);
  const yearNorm = normOf(
    (yearProd.get(lastParts.year) ?? 1) - 1,
    [...yearProd.entries()].filter(([year]) => year !== lastParts.year).map(([, prod]) => prod - 1),
  );
  const weekdayHistory = (weekdayValues[lastParts.weekday] ?? []).slice(0, -1);
  const weekdayNorm = normOf(lastRet, weekdayHistory);
  const norms: NormCompare[] = [
    {
      key: "day",
      label: "今日",
      detail: `${lastParts.iso} ${weekdayZh[lastParts.weekday] ?? lastParts.weekday}`,
      norm: "其余交易日",
      current: lastRet,
      ...dayNorm,
      partial: false,
      also:
        weekdayNorm.n > 0
          ? { norm: `历年${weekdayZh[lastParts.weekday] ?? "这一天"}`, ...weekdayNorm }
          : null,
    },
    {
      key: "week",
      label: "本周",
      detail: weekOpen ? "这周还没收完" : "这周已收到周五",
      norm: "其余各周",
      current: (weekProd.get(currentWeekKey) ?? 1) - 1,
      ...weekNorm,
      partial: weekOpen,
      also: null,
    },
    {
      key: "month",
      label: "本月",
      detail: monthOpen ? "这个月还没走完" : "这个月已经收完",
      norm: `历年${MONTHS[lastParts.month - 1] ?? "这个月"}`,
      current: currentMonthRet,
      ...monthNorm,
      partial: monthOpen,
      also: null,
    },
    {
      key: "quarter",
      label: "本季",
      detail: quarterOpen ? "这个季度还没走完" : "这个季度已经收完",
      norm: `历年${QUARTERS[currentQuarter] ?? "这个季度"}`,
      current: currentQuarterRet,
      ...quarterNorm,
      partial: quarterOpen,
      also: null,
    },
    {
      key: "year",
      label: "本年",
      detail: yearOpen ? "今年还没走完" : "今年已经收完",
      norm: "其余各年",
      current: (yearProd.get(lastParts.year) ?? 1) - 1,
      ...yearNorm,
      partial: yearOpen,
      also: null,
    },
  ];

  const quarterKey = (session: SessionPoint) => `${session.year}-${Math.floor((session.month - 1) / 3)}`;
  const forward: Record<DistSpan, ForwardView> = {
    day: buildForward(sessions, false, "今日", "day", (session) => session.iso, () => "单个交易日"),
    week: buildForward(
      sessions,
      weekOpen,
      "本周",
      "week",
      (session) => session.weekKey,
      (offset, complete) => (complete ? "完整的一周" : `这周的第 ${offset + 1} 个交易日`),
    ),
    month: buildForward(
      sessions,
      monthOpen,
      "本月",
      "month",
      (session) => `${session.year}-${session.month}`,
      (offset, complete) => (complete ? "完整的月份" : `这个月的第 ${offset + 1} 个交易日`),
    ),
    quarter: buildForward(
      sessions,
      quarterOpen,
      "本季",
      "quarter",
      quarterKey,
      (offset, complete) => (complete ? "完整的季度" : `这个季度的第 ${offset + 1} 个交易日`),
    ),
    year: buildForward(
      sessions,
      yearOpen,
      "本年",
      "year",
      (session) => String(session.year),
      (offset, complete) => (complete ? "完整的一年" : `今年的第 ${offset + 1} 个交易日`),
    ),
  };

  const hourly = args.hourly
    .filter((bar) => Number.isFinite(bar.o) && Number.isFinite(bar.c) && bar.o > 0)
    .sort((a, b) => a.t - b.t);
  const byDay = new Map<string, Map<string, { o: number; c: number }>>();
  for (const bar of hourly) {
    const parts = etParts(bar.t);
    if (parts.weekday === "Sat" || parts.weekday === "Sun") continue;
    if (parts.year < fromYear) continue;
    const day = byDay.get(parts.iso) ?? new Map();
    day.set(parts.hm, { o: bar.o, c: bar.c });
    byDay.set(parts.iso, day);
  }

  const hourValues: Record<string, number[]> = Object.fromEntries(HOURS.map((slot) => [slot.key, [] as number[]]));
  let hourFrom = "";
  let hourTo = "";
  let hourSessions = 0;
  for (const [iso, day] of byDay) {
    const closing = day.get("15:30");
    const stub = day.get("16:00");
    if (closing && stub && stub.c > 0) closing.c = stub.c;
    let used = false;
    for (const slot of HOURS) {
      const bar = day.get(slot.key);
      if (!bar) continue;
      const ret = bar.c / bar.o - 1;
      if (!Number.isFinite(ret)) continue;
      hourValues[slot.key].push(ret);
      used = true;
    }
    if (!used) continue;
    hourSessions += 1;
    if (!hourFrom || iso < hourFrom) hourFrom = iso;
    if (!hourTo || iso > hourTo) hourTo = iso;
  }

  const now = etParts(args.nowSec ?? Math.floor(Date.now() / 1000));
  const prevClose = daily[daily.length - 2]?.c ?? daily[daily.length - 1].c;
  const last = daily[daily.length - 1].c;

  return {
    ok: true,
    symbol: meta.symbol,
    name: meta.name,
    short: meta.short,
    note: meta.note,
    last,
    dayChange: last / prevClose - 1,
    firstDate: monthCells.length ? `${monthCells[0].year}-01-01` : lastParts.iso,
    lastDate: lastParts.iso,
    fromYear: monthCells[0]?.year ?? fromYear,
    toYear,
    years,
    sampleDays,
    months: MONTHS.map((label, index) =>
      summarize(String(index + 1), label, MONTHS_SHORT[index], monthBuckets[index]),
    ),
    monthCells,
    quarters: QUARTERS.map((label, index) => summarize(String(index + 1), label, `Q${index + 1}`, quarterValues[index])),
    weekdays: WEEKDAYS.map((day) => summarize(day.key, day.label, day.label, weekdayValues[day.key] ?? [])),
    hours: HOURS.map((slot) => summarize(slot.key, slot.label, slot.key, hourValues[slot.key] ?? [])),
    dists,
    norms,
    forward,
    hourRange: hourSessions > 0 ? { from: hourFrom, to: hourTo, sessions: hourSessions } : null,
    calendar: {
      iso: now.iso,
      month: now.month,
      quarter: Math.floor((now.month - 1) / 3) + 1,
      weekday: now.weekday,
      hourKey: hourKeyAt(args.nowSec ?? Math.floor(Date.now() / 1000)),
    },
    lastSession: {
      iso: lastParts.iso,
      weekday: lastParts.weekday,
      month: lastParts.month,
      ret: lastRet,
    },
  };
}

export function extremes(stats: BucketStat[]) {
  const live = stats.filter((stat) => stat.n > 0);
  if (live.length === 0) return null;
  const byAvg = [...live].sort((a, b) => b.avg - a.avg);
  return { best: byAvg[0], worst: byAvg[byAvg.length - 1] };
}
