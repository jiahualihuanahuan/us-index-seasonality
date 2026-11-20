import { etParts, type DailyBar } from "./seasonality.ts";

/**
 * -3σ seasonal dip ("抄底") signal.
 *
 * A session fires when its close-to-close return sits at or below
 * `threshold` standard deviations from the seasonal norm. The seasonal norm
 * is the same thing the desk's month view uses — 历年同一个月 — applied to
 * daily returns: the mean and population SD of every earlier daily return
 * that fell in the same calendar month, within the trailing window
 * (`years`; 0 = all earlier history). Only sessions before the signal day
 * are used, so the backtest has no look-ahead.
 */

export const DIP_THRESHOLD = -3;
export const DIP_DROP = -0.05;
export const DIP_MIN_SAMPLES = 100;
export const DIP_COOLDOWN = 20;
export const DIP_HORIZONS = [1, 5, 20, 60] as const;

export type DipEvent = {
  iso: string;
  close: number;
  ret: number;
  z: number | null;
  normAvg: number;
  normStdev: number;
  normN: number;
  sigma: boolean;
  drop: boolean;
  /** First signal after at least DIP_COOLDOWN quiet sessions. */
  fresh: boolean;
  next: number | null;
  fwd5: number | null;
  fwd20: number | null;
  fwd60: number | null;
  dd20: number | null;
  dd60: number | null;
  /** Deepest close below the signal close until a close gets back to it. */
  ddRecover: number;
  /** Sessions until a close is back at or above the signal close; null if it has not. */
  recoverDays: number | null;
};

export type DipSummary = {
  n: number;
  nextN: number;
  nextMedian: number | null;
  nextAvg: number | null;
  nextWin: number | null;
  fwd5Median: number | null;
  fwd5Win: number | null;
  fwd20Median: number | null;
  fwd20Win: number | null;
  fwd60Median: number | null;
  fwd60Avg: number | null;
  fwd60Win: number | null;
  ddRecoverMedian: number | null;
  ddRecoverWorst: number | null;
  dd20Median: number | null;
  dd60Median: number | null;
  dd60Worst: number | null;
  recoverMedianDays: number | null;
  unrecovered: number;
};

export type DipReport = {
  threshold: number;
  drop: number;
  years: number;
  minSamples: number;
  firstDate: string;
  lastDate: string;
  sessions: number;
  today: {
    iso: string;
    close: number;
    ret: number;
    z: number | null;
    normAvg: number;
    normStdev: number;
    normN: number;
    cutoff: number | null;
    fires: boolean;
    drop: boolean;
  };
  sigma: { all: DipSummary; fresh: DipSummary };
  drop5: { all: DipSummary; fresh: DipSummary };
  overlap: { dropDays: number; dropAlsoSigma: number; sigmaDays: number; sigmaAlsoDrop: number; scoredDropDays: number };
  events: DipEvent[];
};

type Point = { iso: string; month: number; dayNum: number; close: number; ret: number };

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function winRate(values: number[]) {
  return values.length ? values.filter((value) => value > 0).length / values.length : null;
}

function present(values: Array<number | null>) {
  return values.filter((value): value is number => value != null && Number.isFinite(value));
}

export function summarizeDips(events: DipEvent[]): DipSummary {
  const next = present(events.map((event) => event.next));
  const fwd5 = present(events.map((event) => event.fwd5));
  const fwd20 = present(events.map((event) => event.fwd20));
  const fwd60 = present(events.map((event) => event.fwd60));
  const dd20 = present(events.map((event) => event.dd20));
  const dd60 = present(events.map((event) => event.dd60));
  const recovered = events.filter((event) => event.recoverDays != null);
  const ddRecover = recovered.map((event) => event.ddRecover);
  const allDeep = events.map((event) => event.ddRecover);
  return {
    n: events.length,
    nextN: next.length,
    nextMedian: median(next),
    nextAvg: mean(next),
    nextWin: winRate(next),
    fwd5Median: median(fwd5),
    fwd5Win: winRate(fwd5),
    fwd20Median: median(fwd20),
    fwd20Win: winRate(fwd20),
    fwd60Median: median(fwd60),
    fwd60Avg: mean(fwd60),
    fwd60Win: winRate(fwd60),
    ddRecoverMedian: median(ddRecover),
    ddRecoverWorst: allDeep.length ? Math.min(...allDeep) : null,
    dd20Median: median(dd20),
    dd60Median: median(dd60),
    dd60Worst: dd60.length ? Math.min(...dd60) : null,
    recoverMedianDays: median(recovered.map((event) => event.recoverDays as number)),
    unrecovered: events.length - recovered.length,
  };
}

function dayNumber(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function buildDipReport(args: {
  daily: DailyBar[];
  years: number;
  threshold?: number;
  drop?: number;
  minSamples?: number;
}): DipReport | null {
  const threshold = args.threshold ?? DIP_THRESHOLD;
  const drop = args.drop ?? DIP_DROP;
  const minSamples = args.minSamples ?? DIP_MIN_SAMPLES;
  const years = Math.max(0, Math.floor(args.years));
  const daily = args.daily.filter((bar) => Number.isFinite(bar.c) && bar.c > 0).sort((a, b) => a.t - b.t);

  const points: Point[] = [];
  for (let i = 1; i < daily.length; i += 1) {
    const parts = etParts(daily[i].t);
    if (parts.weekday === "Sat" || parts.weekday === "Sun") continue;
    const ret = daily[i].c / daily[i - 1].c - 1;
    if (!Number.isFinite(ret)) continue;
    points.push({
      iso: parts.iso,
      month: parts.month,
      dayNum: dayNumber(parts.year, parts.month, parts.day),
      close: daily[i].c,
      ret,
    });
  }
  if (points.length < 2) return null;

  // Point-in-time same-month norm: running sums per month, trimmed to the trailing window.
  const byMonth: Array<{ idx: number[]; head: number; sum: number; sq: number }> = Array.from({ length: 13 }, () => ({
    idx: [],
    head: 0,
    sum: 0,
    sq: 0,
  }));
  const windowDays = years > 0 ? Math.round(years * 365.25) : 0;
  const norms: Array<{ z: number | null; avg: number; stdev: number; n: number }> = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const bucket = byMonth[point.month];
    if (windowDays > 0) {
      while (bucket.head < bucket.idx.length && points[bucket.idx[bucket.head]].dayNum < point.dayNum - windowDays) {
        const old = points[bucket.idx[bucket.head]].ret;
        bucket.sum -= old;
        bucket.sq -= old * old;
        bucket.head += 1;
      }
    }
    const n = bucket.idx.length - bucket.head;
    const avg = n ? bucket.sum / n : 0;
    const variance = n ? Math.max(0, bucket.sq / n - avg * avg) : 0;
    const stdev = Math.sqrt(variance);
    const z = n >= minSamples && stdev > 1e-8 ? (point.ret - avg) / stdev : null;
    norms.push({ z, avg, stdev, n });
    bucket.idx.push(i);
    bucket.sum += point.ret;
    bucket.sq += point.ret * point.ret;
  }

  const events: DipEvent[] = [];
  let lastSigma = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const norm = norms[i];
    const sigma = norm.z != null && norm.z <= threshold;
    const isDrop = point.ret <= drop;
    if (!sigma && !isDrop) continue;
    const entry = point.close;
    const at = (k: number) => (i + k < points.length ? points[i + k].close / entry - 1 : null);
    const ddWithin = (k: number) => {
      if (i + k >= points.length) return null;
      let trough = entry;
      for (let j = i + 1; j <= i + k; j += 1) trough = Math.min(trough, points[j].close);
      return Math.min(0, trough / entry - 1);
    };
    let trough = entry;
    let recoverDays: number | null = null;
    for (let j = i + 1; j < points.length; j += 1) {
      if (points[j].close >= entry) {
        recoverDays = j - i;
        break;
      }
      trough = Math.min(trough, points[j].close);
    }
    const fresh = sigma && i - lastSigma > DIP_COOLDOWN;
    if (sigma) lastSigma = i;
    events.push({
      iso: point.iso,
      close: entry,
      ret: point.ret,
      z: norm.z,
      normAvg: norm.avg,
      normStdev: norm.stdev,
      normN: norm.n,
      sigma,
      drop: isDrop,
      fresh,
      next: at(1),
      fwd5: at(5),
      fwd20: at(20),
      fwd60: at(60),
      dd20: ddWithin(20),
      dd60: ddWithin(60),
      ddRecover: Math.min(0, trough / entry - 1),
      recoverDays,
    });
  }

  const sigmaEvents = events.filter((event) => event.sigma);
  const dropEvents = events.filter((event) => event.drop);
  const freshDrops: DipEvent[] = [];
  let lastDrop = -Infinity;
  const indexOf = new Map(points.map((point, index) => [point.iso, index]));
  for (const event of dropEvents) {
    const index = indexOf.get(event.iso) ?? 0;
    if (index - lastDrop > DIP_COOLDOWN) freshDrops.push(event);
    lastDrop = index;
  }

  const last = points[points.length - 1];
  const lastNorm = norms[norms.length - 1];
  return {
    threshold,
    drop,
    years,
    minSamples,
    firstDate: points[0].iso,
    lastDate: last.iso,
    sessions: points.length,
    today: {
      iso: last.iso,
      close: last.close,
      ret: last.ret,
      z: lastNorm.z,
      normAvg: lastNorm.avg,
      normStdev: lastNorm.stdev,
      normN: lastNorm.n,
      cutoff: lastNorm.n >= minSamples ? lastNorm.avg + threshold * lastNorm.stdev : null,
      fires: lastNorm.z != null && lastNorm.z <= threshold,
      drop: last.ret <= drop,
    },
    sigma: { all: summarizeDips(sigmaEvents), fresh: summarizeDips(sigmaEvents.filter((event) => event.fresh)) },
    drop5: { all: summarizeDips(dropEvents), fresh: summarizeDips(freshDrops) },
    overlap: {
      dropDays: dropEvents.length,
      dropAlsoSigma: dropEvents.filter((event) => event.sigma).length,
      scoredDropDays: dropEvents.filter((event) => event.z != null).length,
      sigmaDays: sigmaEvents.length,
      sigmaAlsoDrop: sigmaEvents.filter((event) => event.drop).length,
    },
    events,
  };
}
