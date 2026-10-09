import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppHeading, CommunityEmpty } from "@/components/community-basics";
import { SocialCard, ProfileActions } from "@/components/social-interactions";
import { appViewer } from "@/server/app-view";
import { communitySearch } from "@/server/community-social";
import { sports } from "@/content/sports";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search Docked",
  robots: { index: false, follow: false },
};
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = (await searchParams).q?.slice(0, 100).trim() ?? "";
  const [{ who }, data] = await Promise.all([appViewer(), communitySearch(q)]);
  const matchedSports =
    q.length > 1
      ? sports.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
      : [];
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="DISCOVERY" title="Find a perspective.">
        Search visible members, discussions and sports. Private fields are never
        searched or returned.
      </AppHeading>
      <form className="app-form" method="get">
        <label>
          Search Docked
          <input
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            defaultValue={q}
            placeholder="Sport, topic or member handle"
          />
        </label>
        <button className="button">Search</button>
      </form>
      {q.length > 1 && (
        <div className="search-results">
          {data.status !== "ready" && (
            <p className="app-state-banner">{data.message}</p>
          )}
          {data.profiles.map((p) => (
            <section className="search-result" key={p.id}>
              <h2>
                <Link href={`/profile/${p.handle}`}>
                  {p.displayName} · @{p.handle}
                </Link>
              </h2>
              <p>{p.bio}</p>
              <ProfileActions profile={p} />
            </section>
          ))}
          {data.posts.map((p) => (
            <SocialCard key={p.id} post={p} />
          ))}
          {matchedSports.map((s) => (
            <section className="search-result" key={s.slug}>
              <p className="eyebrow">SPORT</p>
              <h2>
                <Link href={`/sports/${s.slug}`}>{s.title}</Link>
              </h2>
              <p>
                Community discussion. Fantasy sport availability is shown on the
                sport page.
              </p>
            </section>
          ))}
          {!data.profiles.length &&
            !data.posts.length &&
            !matchedSports.length && (
              <CommunityEmpty title="No visible matches">
                Try a different sport, topic or handle. Restricted records are
                not disclosed in search.
              </CommunityEmpty>
            )}
        </div>
      )}
    </AppShell>
  );
}
