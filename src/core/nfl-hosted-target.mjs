import target from "../../config/nfl-hosted-testing.json" with { type: "json" };
export const nflHostedTarget = target;
const production = "pojoymtniryarxxunyvz";

/** Exact reviewed binding, never an arbitrary environment-supplied allowlist.
 * @param {Record<string,any>} [binding] */
export function requireNflHostedTarget(binding = target) {
  const fail = () => {
    throw Error("NFL hosted testing target is not approved and bound");
  };
  if (
    binding.approved !== true ||
    !binding.approvalReference ||
    !/^[a-z]{20}$/.test(binding.projectRef ?? "") ||
    binding.projectRef === production ||
    !/^aws-[0-9]+-ap-southeast-2\.pooler\.supabase\.com$/.test(
      binding.poolerHost ?? "",
    ) ||
    binding.vercelProjectId !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
    binding.databaseMarker !== "docked-isolated-nfl-testing-v1" ||
    binding.readerRole !== "docked_nfl_test_reader" ||
    binding.writerRole !== "docked_nfl_test_writer"
  )
    fail();
  if (binding.transport === "signed-batch") {
    if (
      binding.feedOrigin !== null ||
      binding.batchImportOrigin !==
        "https://docked-preview-s24-briant-ginty.vercel.app"
    )
      fail();
    return binding;
  }
  const feed = new URL(binding.feedOrigin ?? "https://invalid.invalid");
  if (
    feed.protocol !== "https:" ||
    !/^docked-nfl-test-feed(?:-[a-z0-9]+)?\.onrender\.com$/.test(
      feed.hostname,
    ) ||
    feed.origin !== binding.feedOrigin ||
    feed.username ||
    feed.password ||
    feed.search ||
    feed.hash
  )
    fail();
  return binding;
}

/** @param {string} raw @param {string|undefined} environment @param {Record<string,any>} [binding] */
export function testingDatabaseTarget(raw, environment, binding = target) {
  const url = new URL(raw);
  if (
    environment === "production" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hash ||
    url.search
  )
    throw Error("Isolated NFL database required");
  if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    if (!/^\/docked_nfl_test_[a-z0-9_]+$/.test(url.pathname))
      throw Error("Disposable test database required");
    return { hosted: false, role: decodeURIComponent(url.username) };
  }
  const b = requireNflHostedTarget(binding);
  if (
    environment !== "preview" ||
    url.pathname !== "/postgres" ||
    url.port !== "5432" ||
    !url.password
  )
    throw Error("Preview database binding required");
  const session = url.hostname === b.poolerHost;
  if (!session && url.hostname !== `db.${b.projectRef}.supabase.co`)
    throw Error("Database host mismatch");
  const user = decodeURIComponent(url.username);
  const role = [b.readerRole, b.writerRole].find(
    (r) => user === (session ? `${r}.${b.projectRef}` : r),
  );
  if (!role) throw Error("Restricted NFL database role required");
  return { hosted: true, role };
}
