/** Server-side transport. Credentials never enter browser props or diagnostic errors. */
export async function feedRequest(
  config: { origin: string; key: string },
  path: string,
  body?: unknown,
) {
  const u = new URL(config.origin);
  const local =
    process.env.NODE_ENV === "test" &&
    u.protocol === "http:" &&
    u.hostname === "127.0.0.1";
  if (
    (u.protocol !== "https:" && !local) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    config.key.length < 24 ||
    !/^\/(admin\/multisport\/(status|jobs|retry|diagnostics)|v1\/sports\/(epl|nba|afl|nrl)\/stat-changes(?:\?[^#]*)?)$/.test(
      path,
    )
  )
    throw Error("Bound service origin/path required");
  const r = await fetch(new URL(path, u), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error(`Feed HTTP ${r.status}`);
  const reader = r.body?.getReader();
  if (!reader) throw Error("Feed body missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8 * 1024 * 1024) throw Error("Feed response too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
