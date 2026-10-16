import { competitionNames } from "@/core/competition-display";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sports } from "@/content/sports";
import { AppAuthShell } from "@/components/app-auth-shell";
export default async function Sport({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const item = sports.find((s) => s.slug === sport);
  if (!item) notFound();
  return (
    <AppAuthShell>
      <h1>{item.title}</h1>
      <p>
        {sport === "nfl"
          ? `The invited NFL beta offers seven-player ${competitionNames.SALARY_CAP} and ${competitionNames.OPEN} competitions with post-game scoring.`
          : "Fantasy gameplay for this sport is not available yet."}
      </p>
      {sport === "nfl" && (
        <p>
          <Link href="/fantasy/play">NFL cards & competitions</Link>
        </p>
      )}
      <p>
        <Link href={"/feed?sport=" + sport}>Community discussion</Link>
      </p>
      <Link href="/sports">All sports</Link>
    </AppAuthShell>
  );
}
