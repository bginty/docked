import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Docked — Sport. Price. Community.",
    short_name: "Docked",
    description:
      "Sports discussion and transparent verified records. No guaranteed returns.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5ef",
    theme_color: "#142b35",
    lang: "en",
    icons: [
      {
        src: "/icons/docked-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/docked-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/docked-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
