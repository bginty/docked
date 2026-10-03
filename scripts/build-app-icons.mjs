// Original Docked letterform; no third-party brand or image asset.
import sharp from "sharp";
await Promise.all([sharp("public/icons/docked.svg").resize(192).png().toFile("public/icons/docked-192.png"),sharp("public/icons/docked.svg").png().toFile("public/icons/docked-512.png"),sharp("public/icons/docked.svg").png().toFile("public/icons/docked-maskable-512.png")]);
