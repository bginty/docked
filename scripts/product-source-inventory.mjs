import ts from "typescript";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(d + "/" + x.name) : [d + "/" + x.name],
  );
const files = walk("src").filter((p) => /\.(ts|tsx|mjs|js)$/.test(p));
const edges = new Map();
for (const f of files) {
  const source = ts.createSourceFile(
    f,
    readFileSync(f, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  function visit(n) {
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      n.moduleSpecifier &&
      ts.isStringLiteral(n.moduleSpecifier)
    )
      imports.push(n.moduleSpecifier.text);
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(n.arguments[0])
    )
      imports.push(n.arguments[0].text);
    ts.forEachChild(n, visit);
  }
  visit(source);
  edges.set(
    f,
    imports.flatMap((i) => {
      const base = i.startsWith("@/")
        ? "src/" + i.slice(2)
        : i.startsWith(".")
          ? path.posix.normalize(path.posix.join(path.posix.dirname(f), i))
          : null;
      if (!base) return [];
      const resolved = [
        base,
        ...[".ts", ".tsx", ".mjs", ".js", "/index.ts"].map((x) => base + x),
      ].find(existsSync);
      return resolved ? [resolved] : [];
    }),
  );
}
const roots = files.filter(
  (f) =>
    f.startsWith("src/app/") ||
    ["src/proxy.ts", "src/instrumentation.ts"].includes(f),
);
const used = new Set();
const visit = (f) => {
  if (used.has(f)) return;
  used.add(f);
  for (const d of edges.get(f) ?? []) visit(d);
};
roots.forEach(visit);
const unused = files.filter((f) => !used.has(f));
writeFileSync(
  "private-data/product-unused.json",
  JSON.stringify(unused, null, 2),
);
writeFileSync(
  "private-data/product-dependencies.json",
  JSON.stringify(Object.fromEntries(edges), null, 2),
);
console.log(
  JSON.stringify({
    runtimeModules: used.size,
    unreachable: unused.length,
    files: unused,
  }),
);
