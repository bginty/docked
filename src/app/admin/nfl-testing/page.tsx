import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { openNflTestingDatabase } from "@/server/nfl-testing-database";
import { nflTestingReport } from "@/server/nfl-testing-report";
import { NflTestingPanel } from "@/components/nfl-testing-panel";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "NFL postgame testing",
  robots: { index: false, follow: false },
};
export default async function NflTestingPage() {
  try {
    await requireRole(["owner"]);
  } catch {
    notFound();
  }
  if (
    !process.env.DOCKED_NFL_TEST_DATABASE_URL ||
    process.env.VERCEL_ENV === "production"
  )
    return (
      <section className="fantasy-panel">
        <h1>NFL postgame testing</h1>
        <p>
          Local integration only. An isolated testing database and reviewed
          hosted feed connection are not configured here.
        </p>
      </section>
    );
  const connection = openNflTestingDatabase();
  try {
    return <NflTestingPanel report={await nflTestingReport(connection.db)} />;
  } finally {
    await connection.close();
  }
}
