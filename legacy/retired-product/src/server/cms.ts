import "server-only";
import { cache } from "react";
import {
  educationalDrafts,
  editorialVisible,
  type EditorialArticle,
} from "@/content/editorial";
import { config } from "./config";
import { db } from "./db";
import { editorialRead } from "@/core/editorial-access";
type CmsRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  published_at: Date | null;
  expires_at: Date | null;
  revision: number;
};
async function projectArticle(row: CmsRow): Promise<EditorialArticle> {
  const revisions =
    await db()`select reason,created_at from private.article_revisions where article_id=${row.id} order by created_at`;
  const corrections = revisions
    .filter((r) => row.published_at && r.created_at > row.published_at)
    .map((r) => ({ at: r.created_at.toISOString(), reason: r.reason }));
  const summary = row.body.trim().replace(/\s+/g, " ").slice(0, 155);
  return {
    slug: row.id,
    title: row.title,
    category: "Editorial",
    minutes: Math.max(1, Math.ceil(row.body.split(/\s+/).length / 200)),
    summary,
    sections: [["Article", row.body]],
    published: true,
    createdAt: revisions[0]?.created_at.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
    updatedAt:
      revisions.at(-1)?.created_at.toISOString() ??
      row.published_at?.toISOString() ??
      null,
    author: "Docked editorial",
    corrections,
  };
}
function visible(row: CmsRow) {
  return editorialVisible({
    status: row.status,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
  });
}
export const publishedArticle = cache(
  async (slug: string): Promise<EditorialArticle | null> => {
    if (!config().database)
      return educationalDrafts().find((a) => a.slug === slug) ?? null;
    return editorialRead(async () => {
      const rows = await db()<
        CmsRow[]
      >`select id,title,body,status,published_at,expires_at,revision from private.articles where id=${slug}`;
      // An unpublished, withdrawn or expired CMS revision must never fall through to an older bundled copy.
      if (rows[0]) return visible(rows[0]) ? projectArticle(rows[0]) : null;
      return educationalDrafts().find((a) => a.slug === slug) ?? null;
    });
  },
);
export const readingRoom = cache(async (): Promise<EditorialArticle[]> => {
  if (!config().database) return educationalDrafts();
  return editorialRead(async () => {
    const rows = await db()<
      CmsRow[]
    >`select id,title,body,status,published_at,expires_at,revision from private.articles order by published_at desc nulls last`;
    const entries = await Promise.all(rows.filter(visible).map(projectArticle));
    return [
      ...entries,
      ...educationalDrafts().filter((a) => !rows.some((r) => r.id === a.slug)),
    ];
  });
});
