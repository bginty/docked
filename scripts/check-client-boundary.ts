import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const markers = [
  "SUPABASE",
  "ODDS",
  "ODDSPAPI",
  "RESULTS",
  "SCANNER",
  "EMAIL",
].map((name) => `DOCKED_BUILD_CANARY_${name}_20261002`);
async function inspect(directory: string): Promise<number> {
  let checked = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checked += await inspect(file);
    else if (/\.(js|json|html|map)$/.test(entry.name)) {
      const text = await readFile(file, "utf8");
      if (markers.some((marker) => text.includes(marker)))
        throw new Error(`Server credential test marker leaked into ${file}`);
      checked++;
    }
  }
  return checked;
}
void inspect(path.resolve(".next/static"))
  .then((checked) => {
    if (!checked) throw new Error("No browser assets found; build first");
    console.log(
      `PASS: server credential test markers absent from ${checked} browser assets. Build must use the documented canary values.`,
    );
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
