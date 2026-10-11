import { notFound } from "next/navigation";
import { packRevealPreview } from "@/core/pack-opening";
import { PackOpeningPreview } from "@/components/pack-opening-preview";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked pack opening · Design Preview",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (!packRevealPreview()) notFound();
  return <PackOpeningPreview />;
}
