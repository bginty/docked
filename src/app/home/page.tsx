import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Keep installed app entry points and existing saved feed URLs working. */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  if (query.tab || query.sport || query.cursor) {
    const destination = query.tab === "following" ? "/following" : "/feed";
    const params = new URLSearchParams();
    if (query.tab === "latest") params.set("tab", "latest");
    if (query.sport) params.set("sport", query.sport);
    if (query.cursor) params.set("cursor", query.cursor);
    redirect(`${destination}${params.size ? `?${params}` : ""}`);
  }
  redirect("/edges");
}
