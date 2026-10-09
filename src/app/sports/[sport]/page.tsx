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
        {sport === "football"
          ? "Football fantasy cards use fictional players and simulated scoring in Preview."
          : "Fantasy gameplay for this sport is not available yet."}
      </p>
      {sport === "football" && (
        <p>
          <Link href="/fantasy/play">Football cards & competitions</Link>
        </p>
      )}
      <p>
        <Link href={"/feed?sport=" + sport}>Community discussion</Link>
      </p>
      <Link href="/sports">All sports</Link>
    </AppAuthShell>
  );
}
