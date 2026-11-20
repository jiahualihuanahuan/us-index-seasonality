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

  for (let i = 1; i < daily.length; i += 1) {
    const parts = etParts(daily[i].t);
    if (parts.weekday === "Sat" || parts.weekday === "Sun") continue;
    const ret = daily[i].c / daily[i - 1].c - 1;
    if (!Number.isFinite(ret)) continue;
    if (parts.year < fromYear) continue;
    sampleDays += 1;
    lastRet = ret;
    if (weekdayValues[parts.weekday]) weekdayValues[parts.weekday].push(ret);
    const key = `${parts.year}-${parts.month}`;
    const acc = monthAcc.get(key) ?? { year: parts.year, month: parts.month, prod: 1 };
    acc.prod *= 1 + ret;
    monthAcc.set(key, acc);
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
  let sessions = 0;
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
    sessions += 1;
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
    hourRange: sessions > 0 ? { from: hourFrom, to: hourTo, sessions } : null,
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
