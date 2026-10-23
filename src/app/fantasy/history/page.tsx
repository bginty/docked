import { requireIdentity } from "@/server/auth";
import { HistoricalFixtures } from "@/components/historical-fixtures";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireIdentity();
  return <HistoricalFixtures />;
}
