import type { MetadataRoute } from "next";
/** Protected Preview has no public content inventory. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
