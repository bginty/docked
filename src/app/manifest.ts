import type { MetadataRoute } from "next";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { brand } from "@/brand/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Docked — COLLECT. BUILD. COMPETE.",
    short_name: "Docked",
    description: "Fantasy sports cards. Closed Preview.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: brand.colors.navy,
    theme_color: brand.colors.navy,
    lang: "en",
    icons: [
      {
        src: fantasyAssets.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: fantasyAssets.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: fantasyAssets.maskable,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
