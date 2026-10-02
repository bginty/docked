import { articles } from "@/content/articles";
import { config } from "./config";
import { db } from "./db";
export async function publishedArticle(slug: string) {
  if (config().database) {
    try {
      const sql = db();
      const rows =
        await sql`select id,title,body,published_at from private.articles where id=${slug} and status in ('published','corrected') and (expires_at is null or expires_at>now())`;
      if (rows[0])
        return {
          slug: rows[0].id,
          title: rows[0].title,
          category: "Editorial",
          minutes: Math.max(
            1,
            Math.ceil(rows[0].body.split(/\s+/).length / 200),
          ),
          summary: "Evidence-reviewed editorial publication.",
          sections: [["Article", rows[0].body]],
          published: true,
        };
    } catch {
      /* Education remains readable during an outage. */
    }
  }
  const article = articles.find((a) => a.slug === slug);
  return article ? { ...article, published: false } : null;
}
