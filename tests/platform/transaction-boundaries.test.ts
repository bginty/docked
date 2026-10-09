import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

async function sources(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((e) =>
        e.isDirectory()
          ? sources(path.join(directory, e.name))
          : e.name.endsWith(".ts")
            ? [path.join(directory, e.name)]
            : [],
      ),
    )
  ).flat();
}
function calls(root: ts.Node) {
  const result: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return result;
}
test("server transaction callbacks never reacquire global DB, identity, policy or analytics connections", async () => {
  const findings: string[] = [];
  const globalHelpers = new Set([
    "db",
    "rateLimit",
    "identity",
    "requireIdentity",
    "requireRole",
    "authClient",
    "regionAccess",
    "communityAccess",
    "requireCommunityAccess",
    "recordAnalytics",
    "previewCommunityPolicy",
  ]);
  for (const file of [
    ...(await sources("src/server")),
    ...(await sources("src/app/api")),
  ]) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const call of calls(source)) {
      const name = ts.isIdentifier(call.expression)
        ? call.expression.text
        : ts.isPropertyAccessExpression(call.expression)
          ? call.expression.name.text
          : "";
      if (
        !["begin", "withCommunityActor", "reservedTransaction"].includes(name)
      )
        continue;
      for (const callback of call.arguments.filter(
        (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a),
      )) {
        for (const inner of calls(callback)) {
          if (
            ts.isIdentifier(inner.expression) &&
            globalHelpers.has(inner.expression.text)
          ) {
            const line =
              source.getLineAndCharacterOfPosition(inner.getStart()).line + 1;
            findings.push(`${file}:${line} ${inner.expression.text}`);
          }
        }
      }
    }
  }
  assert.deepEqual(
    findings,
    [],
    "pool max=1 would self-deadlock; pass the current transaction or consume durable budgets before beginning it",
  );
});

test("notification actions retain explicit per-user limits on their transaction boundary", async () => {
  for (const [file, functionName, scope, limit] of [
    [
      "src/server/community-social.ts",
      "mutateCommunityNotifications",
      "social:notifications",
      30,
    ],
  ] as const) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const fn = source.statements.find(
      (n) => ts.isFunctionDeclaration(n) && n.name?.text === functionName,
    );
    assert.ok(fn, functionName);
    const invocation = calls(fn).find(
      (c) =>
        ts.isIdentifier(c.expression) &&
        c.expression.text === "withCommunityActor",
    );
    assert.ok(
      invocation && invocation.arguments.length === 4,
      `${functionName} must retain a durable budget`,
    );
    const budget = invocation.arguments[3];
    assert.ok(ts.isObjectLiteralExpression(budget));
    const values = Object.fromEntries(
      budget.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.getText(source), p.initializer.getText(source)]),
    );
    assert.equal(values.scope, JSON.stringify(scope));
    assert.equal(values.limit, String(limit));
  }
});
