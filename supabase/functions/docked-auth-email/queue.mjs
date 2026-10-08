import {
  graphAssertion,
  projectUrl,
  productionRecipientAllowed,
} from "./mail.mjs";

const encode = new TextEncoder();
const b64 = (v) => btoa(String.fromCharCode(...new Uint8Array(v)));
const unb64 = (v) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
const hex = (v) =>
  [...new Uint8Array(v)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function keys(secret) {
  if (!/^v1,whsec_[A-Za-z0-9+/=]+$/.test(secret ?? ""))
    throw Error("Queue key unavailable");
  const material = unb64(secret.slice(9));
  if (material.length < 32) throw Error("Queue key unavailable");
  const root = await crypto.subtle.importKey("raw", material, "HKDF", false, [
    "deriveKey",
  ]);
  const derive = (purpose, algorithm, usages) =>
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encode.encode(projectUrl),
        info: encode.encode(purpose),
      },
      root,
      algorithm,
      false,
      usages,
    );
  return {
    encryption: await derive(
      "docked-auth-mail-encryption-v1",
      { name: "AES-GCM", length: 256 },
      ["encrypt", "decrypt"],
    ),
    identity: await derive(
      "docked-auth-mail-idempotency-v1",
      { name: "HMAC", hash: "SHA-256", length: 256 },
      ["sign"],
    ),
  };
}

export async function queueJobs(
  messages,
  secret,
  mode,
  diagnosticId = undefined,
) {
  if (!["controlled", "production"].includes(mode))
    throw Error("Invalid queue mode");
  const key = await keys(secret);
  return await Promise.all(
    messages.map(async (message) => {
      const recipient = message.toRecipients?.[0]?.emailAddress?.address;
      if (
        message.toRecipients?.length !== 1 ||
        !recipient ||
        (mode === "controlled" &&
          recipient.toLowerCase() !== "support@docked.com.au")
      )
        throw Error("Unapproved controlled recipient");
      const diagnostic =
        mode === "controlled" && /^[a-f0-9]{64}$/.test(diagnosticId ?? "");
      const link = diagnostic
        ? null
        : new URL(
            message.body.content
              .split("\n")
              .find((line) => line.startsWith("https://")),
          );
      const token = diagnostic
        ? diagnosticId
        : (link.searchParams.get("token") ??
          link.searchParams.get("token_hash"));
      const action = diagnostic ? "diagnostic" : link.searchParams.get("type");
      if (!token || !action) throw Error("Missing authentication link");
      // Stable across signed-hook retries, encryption nonces and webhook IDs.
      const id = hex(
        await crypto.subtle.sign(
          "HMAC",
          key.identity,
          encode.encode(
            JSON.stringify([mode, recipient.toLowerCase(), action, token]),
          ),
        ),
      );
      const plain = encode.encode(JSON.stringify(message));
      const fingerprint = hex(await crypto.subtle.digest("SHA-256", plain));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: encode.encode(mode + ":" + id) },
        key.encryption,
        plain,
      );
      return {
        id,
        fingerprint,
        envelope: { version: 1, iv: b64(iv), ciphertext: b64(ciphertext) },
      };
    }),
  );
}

export function queueRpc(env, fetcher = fetch) {
  if (env.SUPABASE_URL !== projectUrl || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Production queue unavailable");
  return async (action, data) => {
    const response = await fetcher(
      projectUrl + "/rest/v1/rpc/docked_mail_queue",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(3000),
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_action: action, p_data: data }),
      },
    );
    if (!response.ok) throw Error("Queue operation unavailable");
    return await response.json();
  };
}

export async function drainOne({ env, mode, rpc, id, fetcher = fetch }) {
  if (
    env.SUPABASE_URL !== projectUrl ||
    (mode === "production"
      ? env.DOCKED_GRAPH_MAIL_ENABLED !== "true"
      : mode !== "controlled" || env.DOCKED_GRAPH_TEST_ENABLED !== "true")
  )
    throw Error("Mail mode disabled");
  // Pin the registered identity, not just syntactically valid GUIDs.
  if (
    env.GRAPH_TENANT_ID !== "b34880d6-d28e-40c2-b389-232506c69650" ||
    env.GRAPH_CLIENT_ID !== "b725bf93-6183-40c5-9aac-839e02ace03a"
  )
    throw Error("Unexpected Graph application");
  const worker = crypto.randomUUID();
  const args = { mode, worker, ...(id ? { id } : {}) };
  const job = await rpc("claim", args);
  if (!job) return { state: "idle" };
  const settle = (state, code) =>
    rpc("settle", { ...args, id: job.id, state, code });
  let message;
  try {
    const key = await keys(env.SEND_EMAIL_HOOK_SECRET);
    if (job.envelope.version !== 1) throw Error("Invalid envelope");
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unb64(job.envelope.iv),
        additionalData: encode.encode(mode + ":" + job.id),
      },
      key.encryption,
      unb64(job.envelope.ciphertext),
    );
    if (hex(await crypto.subtle.digest("SHA-256", plain)) !== job.fingerprint)
      throw Error("Fingerprint mismatch");
    message = JSON.parse(new TextDecoder().decode(plain));
    if (
      message.toRecipients?.length !== 1 ||
      (mode === "production" &&
        !productionRecipientAllowed(
          message.toRecipients[0].emailAddress?.address,
          env,
        )) ||
      (mode === "controlled" &&
        message.toRecipients[0].emailAddress.address.toLowerCase() !==
          "support@docked.com.au")
    )
      throw Error("Unexpected recipient");
  } catch {
    return await settle("failed", "invalid_envelope");
  }
  let accessToken;
  const timings = {};
  const authorizationStarted = performance.now();
  try {
    const { endpoint, assertion } = await graphAssertion(env);
    const authorization = await fetcher(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GRAPH_CLIENT_ID,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      }),
    });
    if (!authorization.ok) throw Error("Authorization failed");
    const token = await authorization.json();
    if (
      typeof token.access_token !== "string" ||
      token.token_type?.toLowerCase() !== "bearer"
    )
      throw Error("Authorization failed");
    accessToken = token.access_token;
  } catch {
    return await settle("pending", "authorization");
  }
  timings.authorizationMs = Math.round(
    performance.now() - authorizationStarted,
  );
  // Persist the dispatch fence BEFORE making the non-idempotent Graph request.
  // If this RPC times out, do not send: a later expired dispatch lease is held.
  const fenced = await rpc("dispatch", { ...args, id: job.id });
  if (fenced?.dispatched !== true) throw Error("Dispatch was not fenced");
  const started = performance.now();
  let state = "unknown",
    code = "ambiguous",
    graphStatus = null;
  try {
    const response = await fetcher(
      "https://graph.microsoft.com/v1.0/users/support%40docked.com.au/sendMail",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      },
    );
    graphStatus = response.status;
    if (response.status === 202) {
      state = "accepted";
      code = "202";
    }
    // No blind retries: even 5xx, disconnects and timeouts may follow acceptance.
    else if ([400, 401, 403, 404, 413, 422].includes(response.status)) {
      state = "failed";
      code = "4xx";
    }
    // 429 is held too: an operator can request a NEW Auth link after Retry-After.
  } catch {
    /* keep unknown; never resend this job automatically */
  }
  timings.sendMs = Math.round(performance.now() - started);
  const outcome = await settle(state, code);
  return {
    id: job.id,
    ...outcome,
    graphStatus,
    timings,
    deliveryVerified: false,
  };
}
