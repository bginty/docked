import { readFileSync } from "node:fs";
/** Keep rendered acceptance on the real stylesheet order, including mobile fixes. */
export function layoutCss() {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  return [...layout.matchAll(/import "\.\/(.+\.css)";/g)]
    .map((match) => readFileSync("src/app/" + match[1], "utf8"))
    .join("\n");
}
