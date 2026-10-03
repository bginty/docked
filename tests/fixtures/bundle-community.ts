import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Local-only browser fixtures; no production resolution or authentication override. */
export async function bundleCommunityFixture(
  entryPoint = "tests/fixtures/community-demo.tsx",
) {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [path.resolve(entryPoint)],
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-mobile-ui",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            let target: string;
            if (/^next\/(navigation|link)$/.test(args.path))
              target = path.resolve(
                "tests/fixtures/community-framework-shim.tsx",
              );
            else if (args.path.startsWith("@/"))
              target = path.resolve("src", args.path.slice(2));
            else if (path.isAbsolute(args.path)) target = args.path;
            else if (args.path.startsWith("."))
              target = path.resolve(path.dirname(args.importer), args.path);
            else
              target = createRequire(
                args.importer || path.resolve("package.json"),
              ).resolve(args.path);
            const file = [
              target,
              target + ".tsx",
              target + ".ts",
              target + ".js",
              path.join(target, "index.js"),
            ].find(existsSync);
            if (!file) throw Error(`Unresolved fixture import: ${args.path}`);
            return { path: file, namespace: "fixture-source" };
          });
          b.onLoad({ filter: /.*/, namespace: "fixture-source" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".json")
                  ? "json"
                  : "jsx",
          }));
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}
