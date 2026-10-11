// Reproducible public-text bundle. Does not approve policies or activate admission.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const version = "2026-10-11-beta-rc3";
const definitions = [
  ["privacy", "Privacy Policy"],
  ["terms", "Terms of Use"],
  ["beta-participation", "Free Beta Participation"],
  ["community", "Community Guidelines"],
  ["fantasy-cards", "Fantasy Card Rules"],
  ["competition-points", "Competition and Points Rules"],
  ["responsible-gambling", "Healthy Participation"],
];
const hash = (s) => createHash("sha256").update(s).digest("hex");
const documents = definitions.map(([id, title]) => {
  const text = readFileSync(
    `docs/policies/${version}/${id}.md`,
    "utf8",
  ).replaceAll("\r\n", "\n");
  if (!text.includes(version)) throw Error("Missing policy version");
  return { id, title, sha256: hash(text), text };
});
const packetDigest = hash(
  documents
    .map((d) => d.id + ":" + d.sha256)
    .sort()
    .join("\n") + "\n",
);
writeFileSync(
  "config/friends-policy-content.json",
  JSON.stringify({ version, packetDigest, documents }, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    version,
    packetDigest,
    documents: documents.length,
    activated: false,
  }),
);
