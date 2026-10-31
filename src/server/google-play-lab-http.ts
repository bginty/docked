import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface GoogleLabService {
  session(): Promise<unknown>;
  receipt(token: string): Promise<unknown>;
  reconcile(): Promise<unknown>;
  refund(key: string): Promise<unknown>;
  pack?(request: string, command: unknown): Promise<unknown>;
}

/** Native-only, loopback TLS test harness. No cookies, CORS, customer identity,
 * arbitrary callback URLs or amount fields. Not imported by any hosted route. */
export function googleLabHandler(
  service: GoogleLabService,
  secret: string,
  expiresAt: number,
) {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw Error("Strong lab pairing secret required");
  let active = 0;
  let windowStart = Date.now();
  let requests = 0;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    if (
      req.socket.remoteAddress !== "127.0.0.1" ||
      req.headers.host !== "127.0.0.1:48591" ||
      req.headers.origin ||
      req.headers.cookie
    )
      return send(403, { error: "Native USB lab access required" });
    const supplied = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    if (
      Date.now() >= expiresAt ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))
    )
      return send(401, { error: "Pairing expired or invalid" });
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (++requests > 90 || active >= 4)
      return send(429, { error: "Retry shortly" });
    active++;
    try {
      if (req.method === "GET" && req.url === "/session")
        return send(200, await service.session());
      if (
        req.method !== "POST" ||
        !["/receipt", "/reconcile", "/refund", "/pack"].includes(req.url ?? "")
      )
        return send(404, { error: "Unknown lab operation" });
      if (req.headers["content-type"] !== "application/json")
        return send(415, { error: "JSON required" });
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) return send(413, { error: "Request too large" });
        chunks.push(Buffer.from(chunk));
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { error: "Invalid JSON" });
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        return send(400, { error: "Invalid request" });
      if (
        req.url === "/receipt" &&
        Object.keys(body).length === 1 &&
        typeof body.token === "string" &&
        /^[^\s\x00-\x1f]{1,4096}$/.test(body.token)
      )
        return send(200, await service.receipt(body.token));
      if (
        req.url === "/refund" &&
        Object.keys(body).length === 1 &&
        typeof body.key === "string" &&
        /^[a-f0-9]{64}$/.test(body.key)
      )
        return send(200, await service.refund(body.key));
      if (req.url === "/reconcile" && Object.keys(body).length === 0)
        return send(200, await service.reconcile());
      if (
        req.url === "/pack" &&
        service.pack &&
        Object.keys(body).sort().join(",") === "command,request" &&
        typeof body.request === "string" &&
        /^[a-zA-Z0-9_-]{8,80}$/.test(body.request)
      )
        return send(200, await service.pack(body.request, body.command));
      return send(400, { error: "Invalid request fields" });
    } catch {
      // Includes provider errors: never expose tokens, OAuth bodies or SQL.
      send(503, {
        error:
          "Lab operation not confirmed. Reconcile or retry; no production wallet is connected.",
      });
    } finally {
      active--;
    }
  };
}
