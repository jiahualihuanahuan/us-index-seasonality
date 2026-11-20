import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDipReport, summarizeDips, type DipEvent } from "./dip-signal.ts";
import type { DailyBar } from "./seasonality.ts";

// Weekday sessions at 16:00 New York (21:00 UTC in winter, 20:00 in summer is fine for date bucketing).
function sessions(startIso: string, rets: number[]): DailyBar[] {
  const bars: DailyBar[] = [];
  let day = new Date(`${startIso}T21:00:00Z`);
  let close = 100;
  bars.push({ t: day.getTime() / 1000, c: close });
  for (const ret of rets) {
    do {
      day = new Date(day.getTime() + 86400000);
    } while (day.getUTCDay() === 0 || day.getUTCDay() === 6);
    close *= 1 + ret;
    bars.push({ t: day.getTime() / 1000, c: close });
  }
  return bars;
}

function isoAt(bars: DailyBar[], index: number) {
  return new Date(bars[index].t * 1000).toISOString().slice(0, 10);
}

// Alternating ±1% gives a same-month mean of 0 and SD of 1%.
const calm = (count: number) => Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));

describe("buildDipReport", () => {
  it("fires at -3σ of the same-month norm and not before enough samples", () => {
    const rets = [...calm(400), -0.035, 0.02, ...calm(70)];
    const bars = sessions("2001-01-02", rets);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    assert.ok(report);
    const sigma = report.events.filter((event) => event.sigma);
    assert.equal(sigma.length, 1);
    const event = sigma[0];
    assert.equal(event.iso, isoAt(bars, 401));
    assert.ok(event.z != null && event.z <= -3);
    assert.equal(event.drop, false);
    assert.equal(event.fresh, true);
    assert.ok(Math.abs((event.next ?? 0) - 0.02) < 1e-9);
  });

  it("does not fire a -2.5% day when the month's SD is 1%", () => {
    const bars = sessions("2001-01-02", [...calm(400), -0.025, ...calm(10)]);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    assert.ok(report);
    assert.equal(report.events.filter((event) => event.sigma).length, 0);
  });

  it("uses only earlier sessions, so the signal day is not in its own norm", () => {
    const bars = sessions("2001-01-02", [...calm(400), -0.2]);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    assert.ok(report);
    assert.ok(report.today.normStdev < 0.0101);
    assert.equal(report.today.fires, true);
    assert.equal(report.today.drop, true);
    assert.equal(report.today.iso, isoAt(bars, bars.length - 1));
    assert.ok(report.today.cutoff != null && Math.abs(report.today.cutoff - (report.today.normAvg - 3 * report.today.normStdev)) < 1e-12);
  });

  it("leaves a day unscored until the month has minSamples", () => {
    const bars = sessions("2001-01-02", [...calm(5), -0.08]);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 100 });
    assert.ok(report);
    assert.equal(report.today.z, null);
    assert.equal(report.today.fires, false);
    assert.equal(report.drop5.all.n, 1);
    assert.equal(report.overlap.scoredDropDays, 0);
  });

  it("measures forward returns and drawdowns from the signal close", () => {
    const path = [-0.1, -0.05, 0.02, 0.03, 0.04, 0.05, 0.01];
    const bars = sessions("2001-01-02", [...calm(400), ...path, ...calm(60)]);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    assert.ok(report);
    const event = report.events.find((item) => item.iso === isoAt(bars, 401));
    assert.ok(event);
    assert.ok(Math.abs((event.next ?? 0) + 0.05) < 1e-9);
    // Deepest close before recovery is the -5% next day.
    assert.ok(Math.abs(event.ddRecover + 0.05) < 1e-9);
    // 0.95 × 1.02 × 1.03 is still below the entry; × 1.04 gets back above it on day 4.
    assert.equal(event.recoverDays, 4);
    const back = 0.95 * 1.02 * 1.03 * 1.04 * 1.05;
    assert.ok(event.dd20 != null && Math.abs(event.dd20 + 0.05) < 1e-9);
    assert.ok(Math.abs((event.fwd5 ?? 0) - (back - 1)) < 1e-9);
  });

  it("marks only the first signal in a 20-session cluster as fresh", () => {
    const bars = sessions("2001-01-02", [...calm(400), -0.06, 0.01, -0.06, ...calm(30), -0.06, ...calm(5)]);
    const report = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    assert.ok(report);
    const sigma = report.events.filter((event) => event.sigma);
    assert.equal(sigma.length, 3);
    assert.deepEqual(
      sigma.map((event) => event.fresh),
      [true, false, true],
    );
    assert.equal(report.sigma.fresh.n, 2);
  });

  it("trims the norm to the trailing window", () => {
    // Ten volatile years (±3%) then calm years (±1%): a -4% day is -3σ only once the window drops the volatile years.
    const loud = Array.from({ length: 2600 }, (_, i) => (i % 2 === 0 ? 0.03 : -0.03));
    const bars = sessions("1980-01-02", [...loud, ...calm(2700), -0.04]);
    const all = buildDipReport({ daily: bars, years: 0, minSamples: 10 });
    const ten = buildDipReport({ daily: bars, years: 10, minSamples: 10 });
    assert.ok(all && ten);
    assert.equal(all.today.fires, false);
    assert.equal(ten.today.fires, true);
  });
});

describe("summarizeDips", () => {
  it("returns nulls for empty input and medians otherwise", () => {
    const empty = summarizeDips([]);
    assert.equal(empty.n, 0);
    assert.equal(empty.nextMedian, null);
    const base = { close: 1, ret: -0.05, z: -3.5, normAvg: 0, normStdev: 0.01, normN: 200, sigma: true, drop: true, fresh: true, fwd5: null, fwd20: null, fwd60: null, dd20: null, dd60: null };
    const events: DipEvent[] = [
      { ...base, iso: "2001-01-01", next: 0.01, ddRecover: 0, recoverDays: 1 },
      { ...base, iso: "2001-02-01", next: -0.02, ddRecover: -0.1, recoverDays: 30 },
      { ...base, iso: "2001-03-01", next: 0.03, ddRecover: -0.2, recoverDays: null },
    ];
    const stat = summarizeDips(events);
    assert.equal(stat.nextMedian, 0.01);
    assert.ok(Math.abs((stat.nextWin ?? 0) - 2 / 3) < 1e-12);
    assert.equal(stat.ddRecoverWorst, -0.2);
    assert.equal(stat.ddRecoverMedian, -0.05);
    assert.equal(stat.unrecovered, 1);
  });
});
