import { createFileRoute } from "@tanstack/react-router";
import { SeasonDesk } from "@/components/season-desk";
import { loadSeasonality } from "@/lib/market.functions";
import type { SeasonalityData } from "@/lib/seasonality";

export const Route = createFileRoute("/")({
  loader: () => loadSeasonality({ data: { symbol: "^GSPC", years: 30 } }),
  component: Home,
});

function Home() {
  const result = Route.useLoaderData();
  const initial: SeasonalityData | null = result.ok ? result : null;
  return <SeasonDesk initial={initial} initialError={result.ok ? null : result.error} />;
}
