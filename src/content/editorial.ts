import { articles } from "./articles";
export type EditorialArticle = {
  slug: string;
  title: string;
  category: string;
  minutes: number;
  summary: string;
  sections: string[][];
  published: boolean;
  createdAt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string;
  corrections: { at: string; reason: string }[];
};
export function educationalDrafts(): EditorialArticle[] {
  return articles.map((a) => ({
    ...a,
    minutes: Math.max(
      1,
      Math.ceil(a.sections.flat().join(" ").split(/\s+/).length / 200),
    ),
    published: false,
    createdAt: "2026-10-02",
    publishedAt: null,
    updatedAt: a.slug === "bookmaker-margin" ? "2026-10-03" : "2026-10-02",
    author: "Docked editorial",
    corrections: [],
  }));
}
export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function editorialVisible(
  row: {
    status: string;
    publishedAt: string | Date | null;
    expiresAt: string | Date | null;
  },
  now = Date.now(),
) {
  const published = row.publishedAt ? new Date(row.publishedAt).getTime() : NaN;
  const expiry = row.expiresAt ? new Date(row.expiresAt).getTime() : Infinity;
  return (
    ["published", "corrected"].includes(row.status) &&
    Number.isFinite(published) &&
    published <= now &&
    expiry > now
  );
}
export function articleStructuredData(article: EditorialArticle, base: string) {
  const url = new URL(`/learn/${article.slug}`, base).toString();
  return {
    "@context": "https://schema.org",
    "@type": article.published ? "Article" : "WebPage",
    headline: article.title,
    name: article.title,
    description: article.summary,
    url,
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    author: {
      "@type": "Organization",
      name: article.author,
      url: new URL("/about", base).toString(),
    },
    publisher: { "@type": "Organization", name: "Docked", url: base },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "en-AU",
    genre: article.published ? "Educational analysis" : "Educational draft",
    ...(article.corrections.length
      ? {
          correction: article.corrections.map((c) => ({
            "@type": "CorrectionComment",
            text: c.reason,
            datePublished: c.at,
          })),
        }
      : {}),
  };
}
