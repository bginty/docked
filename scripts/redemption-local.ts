import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  redemptionFixture,
  redemptionActors,
} from "../tests/fixtures/redemption-state";
import { executeCredits, type CreditsState } from "../src/core/credits-sandbox";
import { redemptionView } from "../src/core/redemption-view";
import {
  prepareRedemption,
  redemptionHttp,
} from "../src/server/redemption-adapter";
import type { Operator } from "../src/core/commerce-sandbox";
import type { RedemptionVault } from "../src/server/redemption-vault";
export type RedemptionBackend = {
  read: () => Promise<CreditsState>;
  execute: (actor: Operator, request: string, op: unknown) => Promise<unknown>;
  vault: RedemptionVault;
};
/** Loopback fixture sessions only. This does not replace or certify Supabase authentication. */
export async function startRedemptionPreview(
  port = 3024,
  backend?: RedemptionBackend,
) {
  const fixture = redemptionFixture();
  let state = fixture.state;
  const store = backend ?? {
    read: async () => state,
    execute: async (actor: Operator, request: string, op: unknown) => {
      const r = executeCredits(
        state,
        actor,
        request,
        prepareRedemption(state, actor, request, op, Date.now(), fixture.vault),
        Date.now(),
      );
      state = r.state;
      return r.result;
    },
    vault: fixture.vault,
  };
  const bundle = await bundleCommunityFixture(
    "tests/fixtures/redemption-preview.tsx",
  );
  const css = (
    await Promise.all(
      [
        "brand-theme",
        "globals",
        "fantasy",
        "fantasy-play",
        "mobile-cleanup",
        "play-cards",
        "redemption",
      ].map((n) => readFile(`src/app/${n}.css`, "utf8")),
    )
  ).join("\n");
  const sessions = new Map<string, Operator>();
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = `http://${req.headers.host}`,
      url = new URL(req.url ?? "/", origin);
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? ""))
        throw Error("Loopback only");
      if (req.method === "POST" && req.headers.origin !== origin) {
        json(403, { error: "Origin denied", outcome: "rejected" });
        return;
      }
      let body = "";
      if (req.method === "POST") {
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 8192) throw Error("Request too large");
        }
      }
      if (url.pathname === "/qa/session" && req.method === "POST") {
        const role = new URLSearchParams(body).get("role") as keyof ReturnType<
          typeof redemptionActors
        >;
        if (!["member", "other", "staff", "staff2"].includes(role))
          throw Error("Unknown fixture");
        const token = randomUUID();
        sessions.set(token, redemptionActors()[role]);
        res.writeHead(303, {
          "Set-Cookie": `redemption_qa=${token}; HttpOnly; SameSite=Strict; Path=/`,
          Location: role.startsWith("staff")
            ? "/admin/redemptions"
            : "/profile/withdrawals",
        });
        res.end();
        return;
      }
      const token = (req.headers.cookie ?? "").match(
          /(?:^|; )redemption_qa=([^;]+)/,
        )?.[1],
        actor = token ? sessions.get(token) : undefined;
      if (url.pathname === "/api/redemptions") {
        if (!actor) {
          json(401, {
            error: "Sign in to an isolated fixture session",
            outcome: "rejected",
          });
          return;
        }
        const admin = url.searchParams.get("admin") === "true";
        redemptionView(await store.read(), actor, admin);
        let result: unknown, revealed: unknown;
        if (req.method === "POST") {
          if (req.headers["content-type"] !== "application/json")
            throw Error("JSON required; document uploads disabled");
          const input = redemptionHttp.parse(JSON.parse(body));
          result = await store.execute(actor, input.request, input.operation);
          const op = input.operation as { action: string; reference: string };
          if (op.action === "bank-access") {
            const s = await store.read(),
              m = s.withdrawals[op.reference]?.manual;
            if (
              !m ||
              m.claimedBy !== actor.id ||
              m.status !== "PAYMENT_IN_PROGRESS"
            )
              throw Error("Claim required");
            revealed = store.vault.open(
              m.destination.ciphertext,
              m.destination.member,
              m.destination.id,
            );
          }
          if (op.action === "evidence-access")
            revealed = {
              fixture: true,
              message: "Synthetic fixture only. No real document collected.",
            };
        }
        json(200, {
          ...redemptionView(await store.read(), actor, admin),
          result,
          revealed,
        });
        return;
      }
      if (url.pathname.startsWith("/brand/")) {
        const path = resolve("public", "." + url.pathname);
        if (!path.startsWith(resolve("public") + "\\"))
          throw Error("Path denied");
        res.setHeader(
          "Content-Type",
          extname(path) === ".webp" ? "image/webp" : "application/octet-stream",
        );
        res.end(await readFile(path));
        return;
      }
      if (url.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle);
        return;
      }
      if (url.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked · local redemption preview</title><link rel="stylesheet" href="/fixture.css"><body style="background:#070e1b;color:#edf4ff">${!actor || url.pathname === "/qa" ? '<main style="max-width:600px;margin:60px auto;padding:24px"><h1>Isolated redemption preview</h1><p>Synthetic credits and identity only. No bank transfer. Fixture session selection is not production authentication.</p><form method="post" action="/qa/session"><label>Fixture role<select name="role"><option value="member">Alex Example · customer</option><option value="other">Jordan Example · other customer</option><option value="staff">Identity / review / payment staff</option><option value="staff2">Second payment staff</option></select></label><button>Open fixture</button></form></main>' : '<div id="root"></div><script src="/fixture.js"></script>'}</body></html>`,
      );
    } catch (e) {
      json(400, {
        error: e instanceof Error ? e.message : "Request failed",
        outcome: "rejected",
      });
    }
  });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  return {
    server,
    sessions,
    store,
    port: (server.address() as { port: number }).port,
  };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startRedemptionPreview()
    .then(() =>
      console.log(
        "Local synthetic redemption preview: http://127.0.0.1:3024/qa",
      ),
    )
    .catch(() => {
      console.error("Preview failed; no sensitive values logged.");
      process.exitCode = 1;
    });
}
