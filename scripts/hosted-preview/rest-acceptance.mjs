// Real GoTrue JWTs and publishable-key REST probes. Never fake Auth rows/claims.
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const root = new URL("../../", import.meta.url);
const directory = new URL("private-data/hosted-preview/", root);
const project = "bckkllmndoxzpzdqrevb";
const checks = [];
let client;
function check(name, passed, details = {}) {
  checks.push({ name, status: passed ? "PASS" : "FAIL", ...details });
  if (!passed) throw new Error(name);
}
try {
  const read = async (name) =>
    JSON.parse(await readFile(new URL(name, directory), "utf8"));
  const connection = await read("connection.json"),
    fixture = await read("acceptance.json"),
    state = await read("state.json");
  check(
    "exact project and organisation",
    connection.projectRef === project &&
      fixture.projectRef === project &&
      connection.organizationId === "ernfnkcbalhyqpsrzdwa" &&
      connection.supabaseUrl === `https://${project}.supabase.co`,
  );
  check(
    "real verified accounts already onboarded",
    !!state.accounts.memberA?.id && !!state.accounts.memberB?.id,
  );
  const rest = async (path, token, method = "GET", body, schema = "public") => {
    const response = await fetch(`${connection.supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: connection.publishableKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        [method === "GET" ? "Accept-Profile" : "Content-Profile"]: schema,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json().catch(() => null),
    };
  };
  for (const table of [
    "profiles",
    "notification_preferences",
    "saved_tips",
    "personal_entries",
  ]) {
    const response = await rest(`${table}?select=*`);
    check(
      `anonymous ${table} read denied`,
      [401, 403].includes(response.status),
      { httpStatus: response.status },
    );
  }
  client = createClient(connection.supabaseUrl, connection.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const account = fixture.accounts.memberB;
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password:
      state.accounts.memberB.passwordVersion === "recovered"
        ? account.recoveryPassword
        : account.password,
  });
  check(
    "genuine member password login",
    !error &&
      data.user?.id === state.accounts.memberB.id &&
      !!data.session?.access_token,
  );
  const token = data.session.access_token;
  const spoof = await client.auth.updateUser({
    data: { role: "admin", roles: ["admin"], aal: "aal2" },
  });
  check(
    "user-editable admin claims accepted only as untrusted metadata",
    !spoof.error,
  );
  for (const [table, column] of [
    ["profiles", "id"],
    ["notification_preferences", "user_id"],
    ["saved_tips", "user_id"],
    ["personal_entries", "user_id"],
  ]) {
    const own = await rest(`${table}?select=*`, token);
    check(
      `member ${table} ownership isolation`,
      own.status === 200 &&
        Array.isArray(own.data) &&
        own.data.every((row) => row[column] === data.user.id) &&
        (!["profiles", "notification_preferences"].includes(table) ||
          own.data.length === 1),
      {
        httpStatus: own.status,
        rows: Array.isArray(own.data) ? own.data.length : null,
      },
    );
    const cross = await rest(
      `${table}?${column}=eq.${state.accounts.memberA.id}`,
      token,
    );
    check(
      `member ${table} cross-user query empty`,
      cross.status === 200 &&
        Array.isArray(cross.data) &&
        cross.data.length === 0,
      { httpStatus: cross.status },
    );
    for (const [method, body] of [
      ["POST", { [column]: data.user.id }],
      ["PATCH", { [column]: data.user.id }],
      ["DELETE", undefined],
    ]) {
      const response = await rest(
        `${table}?${column}=eq.${data.user.id}`,
        token,
        method,
        body,
      );
      check(
        `member ${table} ${method} denied`,
        [401, 403].includes(response.status),
        { httpStatus: response.status },
      );
    }
  }
  for (const table of [
    "roles",
    "odds_snapshots",
    "tip_publications",
    "community_edges",
    "social_posts",
    "market_references",
    "market_reference_methodologies",
    "market_reference_movements",
    "community_edge_personal_notes",
  ]) {
    const response = await rest(
      `${table}?select=*`,
      token,
      "GET",
      undefined,
      "private",
    );
    check(
      `private ${table} unavailable through REST`,
      [401, 403, 406].includes(response.status),
      { httpStatus: response.status },
    );
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const write = await rest(
        `${table}?id=eq.${state.accounts.memberB.id}`,
        token,
        method,
        method === "DELETE" ? undefined : { id: state.accounts.memberB.id },
        "private",
      );
      check(
        `private ${table} ${method} denied`,
        [401, 403, 406].includes(write.status),
        { httpStatus: write.status },
      );
    }
  }
  const capture = await rest(
    "captured_mail?select=*",
    token,
    "GET",
    undefined,
    "preview_auth",
  );
  check(
    "mail credentials never exposed through REST",
    [401, 403, 406].includes(capture.status),
    { httpStatus: capture.status },
  );
  const rpc = await rest(
    "rpc/disable_account",
    token,
    "POST",
    { uid: state.accounts.memberA.id },
    "private",
  );
  check(
    "protected private RPC inaccessible",
    [401, 403, 406].includes(rpc.status),
    { httpStatus: rpc.status },
  );
  const signout = await client.auth.signOut({ scope: "global" });
  check("genuine global signout", !signout.error);
  const revoked = await rest("profiles?select=*", token);
  check(
    "previously issued JWT cannot read after session revocation",
    revoked.status === 200 &&
      Array.isArray(revoked.data) &&
      revoked.data.length === 0,
    { httpStatus: revoked.status },
  );
  const refresh = await client.auth.refreshSession({
    refresh_token: data.session.refresh_token,
  });
  check(
    "revoked refresh token cannot restore session",
    !!refresh.error && !refresh.data.session,
  );
} catch {
  if (!checks.some((row) => row.status === "FAIL"))
    checks.push({ name: "guarded REST runtime", status: "FAIL" });
  process.exitCode = 1;
} finally {
  await writeFile(
    new URL("docs/qa/phase4/rest-results.json", root),
    JSON.stringify(
      { projectRef: project, recordedAt: new Date().toISOString(), checks },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Hosted REST acceptance: ${checks.filter((row) => row.status === "PASS").length} passed; ${checks.filter((row) => row.status === "FAIL").length} failed. Credentials omitted.`,
  );
}
