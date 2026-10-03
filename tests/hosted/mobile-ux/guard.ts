import { readFile, stat } from "node:fs/promises";

export const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
export const projectRef = "bckkllmndoxzpzdqrevb";
export const organizationId = "ernfnkcbalhyqpsrzdwa";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type MobileUxFixture = {
  projectRef: string;
  organizationId: string;
  origin: string;
  qaFixture: true;
  disposable: true;
  runId: string;
  createdAt: string;
  expiresAt: string;
  member: { id: string; email: string; password: string };
};

export class CheckpointFailure extends Error {
  constructor(readonly checkpoint: string) {
    super("Acceptance checkpoint failed");
  }
}
export function check(value: unknown, checkpoint: string): asserts value {
  if (!value) throw new CheckpointFailure(checkpoint);
}

/** Validate the new run independently; an older QA roster or the owner cannot qualify. */
export function validateFixture(
  value: unknown,
  now = Date.now(),
): MobileUxFixture {
  const item = value as Partial<MobileUxFixture> | null;
  check(item && typeof item === "object", "scoped-fixture-required");
  const created = Date.parse(item.createdAt ?? "");
  const expires = Date.parse(item.expiresAt ?? "");
  check(
    item.projectRef === projectRef &&
      item.organizationId === organizationId &&
      item.origin === origin &&
      item.qaFixture === true &&
      item.disposable === true &&
      typeof item.runId === "string" &&
      uuid.test(item.runId) &&
      Number.isFinite(created) &&
      Number.isFinite(expires) &&
      created <= now &&
      now - created < 24 * 60 * 60 * 1000 &&
      expires > now + 15 * 60 * 1000 &&
      expires - created <= 4 * 60 * 60 * 1000 + 60000 &&
      item.member &&
      uuid.test(item.member.id) &&
      item.member.email ===
        `docked-preview-mobile-ux-${item.runId}@example.invalid` &&
      typeof item.member.password === "string" &&
      /^[A-Za-z0-9_-]{40}Aa1!$/.test(item.member.password),
    "fresh-exact-disposable-fixture-required",
  );
  return item as MobileUxFixture;
}

export async function loadFixture() {
  check(
    process.env.DOCKED_MOBILE_UX_ACCEPTANCE === projectRef,
    "explicit-execution-required",
  );
  const file = "private-data/mobile-app-ux/acceptance.json";
  const info = await stat(file);
  check(
    info.isFile() && info.size > 0 && info.size < 20000,
    "bounded-private-fixture",
  );
  // JSON errors are caught by the runner's static error handler, never printed.
  return validateFixture(JSON.parse(await readFile(file, "utf8")));
}

/** Browser may read only the canonical frontend and perform its ordinary login/logout. */
export function allowedRequest(
  urlString: string,
  method: string,
  body: string | null,
) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (["data:", "blob:"].includes(url.protocol)) return method === "GET";
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    [...url.searchParams.keys()].some((key) =>
      /password|token|secret|authorization|email/i.test(key),
    )
  )
    return false;
  if (["GET", "HEAD"].includes(method)) return true;
  if (method !== "POST" || url.pathname !== "/api/auth" || url.search)
    return false;
  try {
    const data = JSON.parse(body ?? "");
    return data.action === "login" || data.action === "logout";
  } catch {
    return false;
  }
}
