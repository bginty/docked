import { notFound } from "next/navigation";
import { packRevealPreview } from "@/core/pack-opening";
import { CardStatisticsPreview } from "@/components/card-statistics-preview";
import examples from "../../../../config/card-statistics-preview.json";
import type { PlayerHistory } from "@/core/player-card-history";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Card statistics · Protected Preview",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (!packRevealPreview()) notFound();
  return (
    <CardStatisticsPreview
      examples={examples.examples.map((e) => ({
        ...e,
        history: e.history as PlayerHistory,
      }))}
    />
  );
}
