import type { MetadataRoute } from "next";
import { readingRoom } from "@/server/cms";
import { sports, leagues } from "@/content/sports";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const root = process.env.SITE_URL ?? "http://localhost:3000";
  const articles = (await readingRoom()).filter((a) => a.published);
  return [
    "",
    "/learn",
    "/methodology",
    "/research",
    "/results",
    "/about",
    "/contact",
    "/safer-gambling",
    "/sports",
    // Canonical sport pages only; /sports/nba permanently redirects to basketball.
    ...sports.map((s) => `/sports/${s.slug}`),
    ...leagues.map((l) => `/leagues/${l.slug}`),
    ...articles.map((a) => `/learn/${a.slug}`),
  ].map((p) => ({
    url: root + p,
    ...(articles.find((a) => p === `/learn/${a.slug}`)?.updatedAt
      ? {
          lastModified: articles.find((a) => p === `/learn/${a.slug}`)!
            .updatedAt!,
        }
      : {}),
    changeFrequency: "monthly",
    priority: p ? 0.6 : 1,
  }));
}
