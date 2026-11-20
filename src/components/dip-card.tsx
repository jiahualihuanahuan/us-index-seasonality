import { MONTHS, pct, pctWin } from "@/lib/seasonality";
import type { DipReport, DipSummary } from "@/lib/dip-signal";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function tone(value: number | null) {
  if (value == null) return "text-muted";
  if (value > 0.0000001) return "text-up";
  if (value < -0.0000001) return "text-down";
  return "text-muted";
}

function sig(z: number | null) {
  if (z == null || !Number.isFinite(z)) return "—";
  return `${z > 0 ? "+" : ""}${z.toFixed(2)}σ`;
}

function cell(value: number | null) {
  return <span className={cn("font-mono tabular-nums", tone(value))}>{value == null ? "—" : pct(value)}</span>;
}

function win(value: number | null) {
  return <span className="font-mono tabular-nums text-fg">{value == null ? "—" : pctWin(value)}</span>;
}

function SummaryRow({ label, note, stat }: { label: string; note: string; stat: DipSummary }) {
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className="text-fg">{label}</span>
        <span className="block text-xs text-faint">{note}</span>
      </th>
      <td className="py-2 pr-3 text-right font-mono tabular-nums text-fg">{stat.n}</td>
      <td className="py-2 pr-3 text-right">
        {cell(stat.nextMedian)}
        <span className="block text-xs">上涨 {win(stat.nextWin)}</span>
      </td>
      <td className="py-2 pr-3 text-right">
        {cell(stat.fwd5Median)}
        <span className="block text-xs">上涨 {win(stat.fwd5Win)}</span>
      </td>
      <td className="py-2 pr-3 text-right">
        {cell(stat.fwd20Median)}
        <span className="block text-xs">上涨 {win(stat.fwd20Win)}</span>
      </td>
      <td className="py-2 pr-3 text-right">
        {cell(stat.fwd60Median)}
        <span className="block text-xs">上涨 {win(stat.fwd60Win)}</span>
      </td>
      <td className="py-2 pr-3 text-right">
        {cell(stat.dd20Median)}
        <span className="block text-xs text-faint">60 日 {cell(stat.dd60Median)}</span>
      </td>
      <td className="py-2 text-right">
        {cell(stat.dd60Worst)}
        <span className="block text-xs text-faint">回本前 {cell(stat.ddRecoverWorst)}</span>
      </td>
    </tr>
  );
}

export function DipCard({ dip, windowLabel }: { dip: DipReport; windowLabel: string }) {
  const today = dip.today;
  const month = MONTHS[Number(today.iso.slice(5, 7)) - 1] ?? "这个月";
  const recent = dip.events.filter((event) => event.sigma).slice(-12).reverse();
  const o = dip.overlap;
  return (
    <section id="dip" className="mb-4 scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <p className="font-serif text-xs tracking-widest text-brass uppercase">Dip</p>
      <h2 className="text-xl font-semibold text-fg">−3σ 抄底信号</h2>
      <p className="mt-1 text-sm text-pretty text-muted">
        当天收盘对收盘的跌幅，比历年同一个月每日涨跌的常态低 3 个标准差以上，就记一次。常态只用信号当天之前、{windowLabel}
        窗口里的同月交易日，至少 {dip.minSamples} 个样本，没有偷看未来。回测跑完整段日线（{dip.firstDate} 至 {dip.lastDate}）。回撤只看收盘；「回本前」是之后第一次收回信号日收盘之前的最深一跌。这是事后分布，不是买卖建议。
      </p>

      <div
        className={cn(
          "mt-3 rounded-xl border px-4 py-3",
          today.fires ? "border-brass bg-brass-dim" : "border-line bg-surface-2",
        )}
      >
        <p className="text-sm text-fg">
          {today.iso} 收盘 {cell(today.ret)} · 相对历年{month}的每日常态{" "}
          <span className={cn("font-mono tabular-nums", tone(today.z))}>{sig(today.z)}</span>
          {" · "}
          <span className={today.fires ? "font-semibold text-brass" : "text-muted"}>
            {today.fires ? "触发" : "未触发"}
          </span>
        </p>
        <p className="mt-1 text-xs text-faint">
          {today.cutoff != null
            ? `今天要跌到 ${pct(today.cutoff)} 或更深才算 −3σ（同月常态 ${pct(today.normAvg)}，波动 ${(today.normStdev * 100).toFixed(2)}%，${today.normN} 个样本）。`
            : "同月样本不够，今天不打分。"}
          {today.drop ? " 今天也跌破了 −5%。" : ""}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="text-xs text-faint">
              <th className="py-2 pr-3 text-left font-normal">规则</th>
              <th className="py-2 pr-3 text-right font-normal">次数</th>
              <th className="py-2 pr-3 text-right font-normal">次日中位</th>
              <th className="py-2 pr-3 text-right font-normal">5 日中位</th>
              <th className="py-2 pr-3 text-right font-normal">20 日中位</th>
              <th className="py-2 pr-3 text-right font-normal">60 日中位</th>
              <th className="py-2 pr-3 text-right font-normal">20 日最深回撤中位</th>
              <th className="py-2 text-right font-normal">60 日最深回撤最差</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow label="−3σ 每一次" note="连跌几天会重复记" stat={dip.sigma.all} />
            <SummaryRow label="−3σ 首次" note="前 20 个交易日没触发过" stat={dip.sigma.fresh} />
            <SummaryRow label="单日跌 5%" note="不看季节常态" stat={dip.drop5.all} />
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-muted">
        跌 5% 的 {o.dropDays} 天里，有 {o.scoredDropDays} 天样本够打分，其中 {o.dropAlsoSigma} 天够到 −3σ。−3σ 的 {o.sigmaDays}{" "}
        天里，{o.sigmaAlsoDrop} 天跌了 5% 以上，其余是在波动低的年份跌得少一些也触发。
      </p>

      {recent.length ? (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-1 text-xs text-faint">最近的信号</p>
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-xs text-faint">
                <th className="py-1 pr-3 text-left font-normal">日期</th>
                <th className="py-1 pr-3 text-right font-normal">当日</th>
                <th className="py-1 pr-3 text-right font-normal">z</th>
                <th className="py-1 pr-3 text-right font-normal">次日</th>
                <th className="py-1 pr-3 text-right font-normal">20 日</th>
                <th className="py-1 pr-3 text-right font-normal">60 日</th>
                <th className="py-1 text-right font-normal">60 日最深回撤</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((event) => (
                <tr key={event.iso} className="border-t border-line">
                  <td className="py-1 pr-3 font-mono tabular-nums text-fg">
                    {event.iso}
                    {event.fresh ? <span className="ml-2 text-xs text-brass">首次</span> : null}
                  </td>
                  <td className="py-1 pr-3 text-right">{cell(event.ret)}</td>
                  <td className="py-1 pr-3 text-right font-mono tabular-nums text-down">{sig(event.z)}</td>
                  <td className="py-1 pr-3 text-right">{cell(event.next)}</td>
                  <td className="py-1 pr-3 text-right">{cell(event.fwd20)}</td>
                  <td className="py-1 pr-3 text-right">{cell(event.fwd60)}</td>
                  <td className="py-1 text-right">{cell(event.dd60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-faint">— 表示后面的交易日还不够。</p>
        </div>
      ) : null}
    </section>
  );
}
