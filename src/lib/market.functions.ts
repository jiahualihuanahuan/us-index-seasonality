import { createServerFn } from "@tanstack/react-start";
import {
  buildSeasonality,
  indexMeta,
  type DailyBar,
  type HourlyBar,
  type SeasonalityResult,
} from "@/lib/seasonality";
import { buildDipReport } from "@/lib/dip-signal";

type CacheEntry = { at: number; daily: DailyBar[]; hourly: HourlyBar[] };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;
const DIP_EVENTS_SENT = 40;
const UA = "Mozilla/5.0 (compatible; Jilv/1.0; +https://finance.yahoo.com)";

type YahooChart = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: Array<number | null>; close?: Array<number | null> }> };
    }> | null;
  };
};

async function yahooChart(symbol: string, interval: "1d" | "1h", period1: number, period2: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}&events=history`;
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`行情源返回 ${response.status}`);
  const body = (await response.json()) as YahooChart;
  if (body.chart?.error) throw new Error(body.chart.error.description || "行情源拒绝了这次请求");
  const result = body.chart?.result?.[0];
  if (!result?.timestamp) throw new Error("行情源没有返回价格");
  return result;
}

async function loadBars(symbol: string): Promise<CacheEntry> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;

  const period2 = Math.floor(Date.now() / 1000);
  const dailyPeriod1 = Math.floor(Date.UTC(1927, 0, 1) / 1000);
  const hourlyPeriod1 = period2 - 729 * 24 * 3600;

  const [dailyResult, hourlyResult] = await Promise.all([
    yahooChart(symbol, "1d", dailyPeriod1, period2),
    yahooChart(symbol, "1h", hourlyPeriod1, period2).catch(() => null),
  ]);

  const dailyTs = dailyResult.timestamp ?? [];
  const dailyClose = dailyResult.indicators?.quote?.[0]?.close ?? [];
  const daily: DailyBar[] = [];
  for (let i = 0; i < dailyTs.length; i += 1) {
    const close = dailyClose[i];
    if (close == null || !(close > 0)) continue;
    daily.push({ t: dailyTs[i], c: close });
  }

  const hourly: HourlyBar[] = [];
  if (hourlyResult?.timestamp) {
    const opens = hourlyResult.indicators?.quote?.[0]?.open ?? [];
    const closes = hourlyResult.indicators?.quote?.[0]?.close ?? [];
    for (let i = 0; i < hourlyResult.timestamp.length; i += 1) {
      const open = opens[i];
      const close = closes[i];
      if (open == null || close == null || !(open > 0) || !(close > 0)) continue;
      hourly.push({ t: hourlyResult.timestamp[i], o: open, c: close });
    }
  }

  const entry = { at: Date.now(), daily, hourly };
  cache.set(symbol, entry);
  return entry;
}

export const loadSeasonality = createServerFn({ method: "GET" })
  .validator((input: { symbol?: string; years?: number }) => {
    const symbol = typeof input?.symbol === "string" ? input.symbol : "^GSPC";
    const years = typeof input?.years === "number" && Number.isFinite(input.years) ? Math.floor(input.years) : 30;
    return { symbol, years };
  })
  .handler(async ({ data }): Promise<SeasonalityResult> => {
    if (!indexMeta(data.symbol)) return { ok: false, error: "不认识这个指数。" };
    try {
      const bars = await loadBars(data.symbol);
      const result = buildSeasonality({
        symbol: data.symbol,
        years: data.years,
        daily: bars.daily,
        hourly: bars.hourly,
      });
      if (!result.ok) return result;
      const dip = buildDipReport({ daily: bars.daily, years: result.years });
      // The page lists recent signals; the full history stays server-side.
      return { ...result, dip: dip ? { ...dip, events: dip.events.slice(-DIP_EVENTS_SENT) } : null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "行情暂时取不到";
      return { ok: false, error: message };
    }
  });
