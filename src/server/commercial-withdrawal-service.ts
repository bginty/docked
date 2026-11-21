import "server-only";
import type { Sql } from "postgres";
import { z } from "zod";
import { requireIdentity, requireRole } from "./auth";
import { rateLimit } from "./db";
import { memberCommercial } from "./member-commercial";
import { commercialRuntime } from "./commercial-runtime";
import { currentConsentVersions } from "../core/auth-readiness";
import { cashWithdrawalPolicyPublished } from "../core/commercial-cash-presentation";
import {
  commercialWithdrawalMemberEnvelope,
  commercialWithdrawalOwnerEnvelope,
  CommercialWithdrawalRejected,
} from "../core/commercial-withdrawals";
import type { BillingEnvironment } from "../core/commercial-billing";
import type { CommercialWithdrawalAccess } from "./commercial-withdrawal-ledger";
import { SumsubCommercialKycProvider } from "./commercial-kyc-provider";
import {
  CommercialWithdrawalVault,
  withdrawalDestinationMask,
} from "./commercial-withdrawal-vault";
import { bankInput } from "./redemption-vault";

const uuid = z.uuid();
const reason = z.string().trim().min(12).max(600);
const recentAuthenticationMs = 15 * 60_000;

function recentAuthentication(at: number) {
  if (
    !at ||
    at > Date.now() + 30_000 ||
    Date.now() - at > recentAuthenticationMs
  )
    throw new CommercialWithdrawalRejected(
      "Please sign in again, including your authenticator if enabled, before continuing.",
    );
}

function identityProvider(environment: BillingEnvironment) {
  const prefix =
    environment === "commercial"
      ? "DOCKED_SUMSUB_"
      : "DOCKED_ACCEPTANCE_SUMSUB_";
  const get = (key: string) => process.env[prefix + key] ?? "";
  const acceptanceOrigin = process.env.DOCKED_WITHDRAWAL_ACCEPTANCE_ORIGIN;
  const algorithm = get("WEBHOOK_ALGORITHM") || "HMAC_SHA256_HEX";
  if (!["HMAC_SHA256_HEX", "HMAC_SHA512_HEX"].includes(algorithm))
    throw new CommercialWithdrawalRejected(
      "Identity verification is not configured.",
    );
  return new SumsubCommercialKycProvider({
    environment,
    appToken: get("APP_TOKEN"),
    secretKey: get("SECRET_KEY"),
    webhookSecret: get("WEBHOOK_SECRET"),
    identityHashKey: get("IDENTITY_HASH_KEY"),
    clientId: get("CLIENT_ID"),
    levelName: get("LEVEL_NAME"),
    returnUrl:
      environment === "commercial"
        ? "https://docked.com.au/profile/withdrawals"
        : `${acceptanceOrigin}/profile/withdrawals`,
    acceptanceReturnOrigin:
      environment === "acceptance" ? acceptanceOrigin : undefined,
    webhookAlgorithm: algorithm as "HMAC_SHA256_HEX" | "HMAC_SHA512_HEX",
    timeoutMs: 6000,
    linkTtlSeconds: 600,
  });
}

function bankVault(environment: BillingEnvironment) {
  const prefix =
    environment === "commercial"
      ? "DOCKED_WITHDRAWAL_BANK_"
      : "DOCKED_ACCEPTANCE_WITHDRAWAL_BANK_";
  const active = process.env[prefix + "KEY_ID"] ?? "";
  const input: unknown = JSON.parse(process.env[prefix + "KEYS"] ?? "null");
  const keys = z
    .record(
      z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
      z.string().regex(/^[a-f0-9]{64}$/),
    )
    .parse(input);
  return new CommercialWithdrawalVault(environment, {
    active,
    values: Object.fromEntries(
      Object.entries(keys).map(([key, value]) => [
        key,
        Buffer.from(value, "hex"),
      ]),
    ),
  });
}

function readiness(environment: BillingEnvironment) {
  let identityConfigured = false,
    bankProtectionConfigured = false;
  try {
    identityProvider(environment);
    identityConfigured = true;
  } catch {
    /* No secret values leave the server. */
  }
  try {
    bankVault(environment);
    bankProtectionConfigured = true;
  } catch {
    /* The existing history still remains readable. */
  }
  return {
    published: cashWithdrawalPolicyPublished(process.env),
    identityConfigured,
    bankProtectionConfigured,
  };
}

async function installedRuntime() {
  const runtime = await commercialRuntime();
  const [schema] = await runtime.ledger
    .sql`select to_regclass('commercial_billing.withdrawal_control') is not null installed`;
  return schema.installed === true ? runtime : null;
}

const unavailable = {
  enabled: false,
  reason: "Cash withdrawals are not available yet.",
  policy: null,
  money: { available: 0, eligible: 0, pending: 0 },
  identity: null,
  destinations: [],
  requests: [],
};

async function memberContext(mutation: boolean) {
  const who = await requireIdentity();
  if (
    mutation &&
    who.user.factors?.some((factor) => factor.status === "verified") &&
    who.aal !== "aal2"
  )
    throw new CommercialWithdrawalRejected(
      "Complete your authenticator check before changing withdrawal details or requesting cash.",
    );
  const commercial = await memberCommercial(mutation ? "mutation" : "read");
  const context = commercial.withdrawalContext(mutation);
  const runtime = await installedRuntime();
  if (!runtime)
    throw new CommercialWithdrawalRejected(
      "Cash withdrawals are not available yet.",
    );
  const setup = readiness(runtime.withdrawals.environment);
  const ready =
    setup.published &&
    setup.identityConfigured &&
    setup.bankProtectionConfigured;
  const access: CommercialWithdrawalAccess = {
    ...context.access,
    requestsEnabled: context.access.requestsEnabled && ready,
    paymentsEnabled: context.access.paymentsEnabled && ready,
  };
  const authorize = async (tx: Sql) => {
    await access.actor(tx);
    await access.member(tx, context.member);
  };
  return { ...context, access, runtime, setup, authorize };
}

export async function memberWithdrawalView() {
  const who = await requireIdentity();
  const runtime = await installedRuntime();
  if (!runtime) {
    const commercial = await memberCommercial("read");
    const wallet = await commercial.wallet();
    return {
      ...unavailable,
      member: who.user.id,
      money: { ...unavailable.money, available: wallet.spendable },
      setup: {
        published: false,
        identityConfigured: false,
        bankProtectionConfigured: false,
      },
    };
  }
  const context = await memberContext(false);
  const view = await runtime.withdrawals.memberView(
    context.member,
    context.access,
  );
  return {
    ...view,
    member: context.member,
    setup: context.setup,
    requests: view.requests.map(
      ({ claimedBy: _claimant, memberId: _member, ...request }) => request,
    ),
  };
}

export async function memberWithdrawalCommand(input: unknown) {
  const parsed = z
    .object({
      expectedMember: uuid,
      request: uuid,
      command: commercialWithdrawalMemberEnvelope.shape.command,
    })
    .strict()
    .parse(input);
  const context = await memberContext(true);
  if (parsed.expectedMember !== context.member)
    throw new CommercialWithdrawalRejected(
      "Your signed-in account changed. Reload before continuing.",
    );
  const [recorded] = await context.runtime.withdrawals
    .sql`select 1 from commercial_billing.withdrawal_commands where actor=${context.member} and request=${parsed.request}`;
  if (parsed.command.kind === "request" && !recorded) {
    recentAuthentication(context.authenticatedAt);
    if (!context.access.requestsEnabled)
      throw new CommercialWithdrawalRejected(
        "New withdrawal requests are currently unavailable.",
      );
    const provider = identityProvider(context.runtime.withdrawals.environment);
    await context.runtime.withdrawals.refreshIdentity(
      context.member,
      {},
      async (binding) =>
        (
          await provider.fetchIdentity(
            context.member,
            binding.providerApplicantId ?? undefined,
          )
        ).evidence,
      context.authorize,
    );
  }
  const result = await context.runtime.withdrawals.memberCommand(
    context.member,
    {
      request: parsed.request,
      command: parsed.command,
    },
    context.access,
  );
  // Command projections can contain staff/member identifiers; clients recover
  // all customer-visible details through their private history endpoint.
  return {
    outcome: "confirmed",
    request: parsed.request,
    id: typeof result.id === "string" ? result.id : null,
  };
}

export async function memberWithdrawalIdentity(input: unknown) {
  const parsed = z
    .object({
      expectedMember: uuid,
      action: z.enum(["start", "refresh"]),
      confirmed: z.literal(true),
    })
    .strict()
    .parse(input);
  const context = await memberContext(true);
  if (parsed.expectedMember !== context.member)
    throw new CommercialWithdrawalRejected(
      "Your signed-in account changed. Reload before continuing.",
    );
  recentAuthentication(context.authenticatedAt);
  if (!context.setup.published || !context.setup.identityConfigured)
    throw new CommercialWithdrawalRejected(
      "Identity verification for withdrawals is not available yet.",
    );
  if (!(await rateLimit(`withdrawal-identity:${context.member}`, 6, 3600)))
    throw new CommercialWithdrawalRejected(
      "Please wait before starting another identity verification.",
    );
  const provider = identityProvider(context.runtime.withdrawals.environment);
  if (parsed.action === "refresh") {
    const identity = await context.runtime.withdrawals.refreshIdentity(
      context.member,
      {},
      async (binding) =>
        (
          await provider.fetchIdentity(
            context.member,
            binding.providerApplicantId ?? undefined,
          )
        ).evidence,
      context.authorize,
    );
    return { outcome: "confirmed", status: identity.status };
  }
  // Persist the exact member/environment binding before releasing any hosted
  // link to the browser. The redirect never grants identity approval.
  const session = await provider.createHostedVerification(context.member);
  await context.runtime.withdrawals.bindIdentitySession(
    context.member,
    {
      externalUserId: session.externalUserId,
      expiresAt: session.expiresAt,
    },
    context.authorize,
  );
  return {
    outcome: "confirmed",
    url: session.url,
    expiresAt: session.expiresAt,
  };
}

export async function memberWithdrawalDestination(input: unknown) {
  const parsed = z
    .object({
      expectedMember: uuid,
      destination: uuid,
      identityRevision: z.number().int().positive(),
      bank: bankInput,
    })
    .strict()
    .parse(input);
  const context = await memberContext(true);
  if (parsed.expectedMember !== context.member)
    throw new CommercialWithdrawalRejected(
      "Your signed-in account changed. Reload before continuing.",
    );
  recentAuthentication(context.authenticatedAt);
  if (!context.setup.published || !context.setup.bankProtectionConfigured)
    throw new CommercialWithdrawalRejected(
      "Bank-account setup is not available yet.",
    );
  const provider = identityProvider(context.runtime.withdrawals.environment);
  let verifiedHash: string | null = null;
  const identity = await context.runtime.withdrawals.refreshIdentity(
    context.member,
    {},
    async (binding) => {
      const result = await provider.fetchIdentity(
        context.member,
        binding.providerApplicantId ?? undefined,
      );
      verifiedHash = result.evidence.legalNameHash;
      return result.evidence;
    },
    context.authorize,
  );
  if (
    identity.revision !== parsed.identityRevision ||
    identity.status !== "approved" ||
    !verifiedHash ||
    verifiedHash !== provider.hashLegalName(parsed.bank.holder)
  )
    throw new CommercialWithdrawalRejected(
      "Use your verified legal name and refresh your identity status before saving bank details.",
    );
  const vault = bankVault(context.runtime.withdrawals.environment);
  const binding = {
    member: context.member,
    destination: parsed.destination,
    identityRevision: identity.revision,
  };
  // A lost response must not turn the same bank-save reference into a second
  // destination. Reuse the frozen randomized ciphertext only after decrypting
  // it under this exact member/identity binding and comparing all input fields.
  const [saved] = await context.runtime.withdrawals
    .sql`select d.identity_revision,p.ciphertext from commercial_billing.withdrawal_destinations d join commercial_billing.withdrawal_destination_payloads p on p.destination=d.id where d.id=${parsed.destination} and d.member_id=${context.member}`;
  let ciphertext: string;
  if (saved) {
    if (
      saved.identity_revision !== identity.revision ||
      JSON.stringify(vault.open(saved.ciphertext, binding)) !==
        JSON.stringify(parsed.bank)
    )
      throw new CommercialWithdrawalRejected(
        "This bank-save reference belongs to different details. Refresh your saved accounts.",
      );
    ciphertext = saved.ciphertext;
  } else ciphertext = vault.seal(parsed.bank, binding);
  const destination = await context.runtime.withdrawals.recordDestination(
    context.member,
    {
      id: parsed.destination,
      identityRevision: identity.revision,
      ciphertext,
      mask: withdrawalDestinationMask(parsed.bank),
    },
    context.authorize,
  );
  return { outcome: "confirmed", destination };
}

async function ownerContext(mutation: boolean) {
  const who = await requireRole(["owner"]);
  if (mutation) recentAuthentication(who.authenticatedAt);
  if (
    !(await rateLimit(
      `withdrawal-owner:${who.user.id}`,
      mutation ? 30 : 90,
      60,
    ))
  )
    throw new CommercialWithdrawalRejected("Please retry shortly.");
  const runtime = await installedRuntime();
  if (!runtime)
    throw new CommercialWithdrawalRejected(
      "The withdrawal release has not been installed.",
    );
  const setup = readiness(runtime.withdrawals.environment);
  const ready =
    setup.published &&
    setup.identityConfigured &&
    setup.bankProtectionConfigured;
  const versions = currentConsentVersions();
  const access: CommercialWithdrawalAccess = {
    requestsEnabled:
      ready && process.env.DOCKED_COMMERCIAL_WITHDRAWAL_REQUESTS === "true",
    paymentsEnabled:
      ready && process.env.DOCKED_COMMERCIAL_WITHDRAWAL_PAYMENTS === "true",
    actor: async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
      const [row] =
        await tx`select commercial_billing.withdrawal_actor_allowed(${who.user.id}::uuid,${who.sessionId}::uuid,${who.aal},true) allowed`;
      if (row?.allowed !== true)
        throw new CommercialWithdrawalRejected(
          "A current Owner session with MFA is required.",
        );
    },
    member: async (tx, member) => {
      const [row] =
        await tx`select commercial_billing.withdrawal_member_allowed(${member}::uuid,${versions.terms},${versions.privacy}) allowed`;
      if (row?.allowed !== true)
        throw new CommercialWithdrawalRejected(
          "The member is not currently eligible for a new bank payment.",
        );
    },
  };
  return { owner: who.user.id, runtime, access, setup };
}

export async function ownerWithdrawalView(input: { request?: string } = {}) {
  const query = z.object({ request: uuid.optional() }).strict().parse(input);
  const context = await ownerContext(false);
  return {
    ...(await context.runtime.withdrawals.ownerView(
      context.owner,
      context.access,
      query,
    )),
    owner: context.owner,
    setup: context.setup,
  };
}

export async function ownerWithdrawalCommand(input: unknown) {
  const parsed = z
    .object({
      expectedOwner: uuid,
      request: uuid,
      command: commercialWithdrawalOwnerEnvelope.shape.command,
    })
    .strict()
    .parse(input);
  const context = await ownerContext(true);
  if (parsed.expectedOwner !== context.owner)
    throw new CommercialWithdrawalRejected(
      "Your signed-in Owner account changed. Reload before continuing.",
    );
  const [recorded] = await context.runtime.withdrawals
    .sql`select 1 from commercial_billing.withdrawal_commands where actor=${context.owner} and request=${parsed.request}`;
  if (parsed.command.kind === "claim" && !recorded) {
    if (!context.access.paymentsEnabled)
      throw new CommercialWithdrawalRejected(
        "New bank payments are currently stopped.",
      );
    const [request] = await context.runtime.withdrawals
      .sql`select member_id from commercial_billing.withdrawals where id=${parsed.command.id}`;
    if (!request)
      throw new CommercialWithdrawalRejected("Withdrawal not found.");
    const provider = identityProvider(context.runtime.withdrawals.environment);
    await context.runtime.withdrawals.refreshIdentity(
      request.member_id,
      {},
      async (binding) =>
        (
          await provider.fetchIdentity(
            request.member_id,
            binding.providerApplicantId ?? undefined,
          )
        ).evidence,
      async (tx) => {
        await context.access.actor(tx);
        await context.access.member(tx, request.member_id);
      },
    );
  }
  return {
    outcome: "confirmed",
    result: await context.runtime.withdrawals.ownerCommand(
      context.owner,
      { request: parsed.request, command: parsed.command },
      context.access,
    ),
  };
}

export async function ownerWithdrawalBank(input: unknown) {
  const parsed = z
    .object({
      expectedOwner: uuid,
      kind: z.enum(["destination", "payment"]),
      id: uuid,
      reason,
    })
    .strict()
    .parse(input);
  const context = await ownerContext(true);
  if (parsed.expectedOwner !== context.owner)
    throw new CommercialWithdrawalRejected(
      "Your signed-in Owner account changed. Reload before continuing.",
    );
  const vault = bankVault(context.runtime.withdrawals.environment);
  if (parsed.kind === "destination") {
    const result = await context.runtime.withdrawals.revealDestination(
      context.owner,
      parsed.id,
      parsed.reason,
      context.access,
    );
    return {
      bank: vault.open(result.ciphertext, {
        member: result.snapshot.memberId,
        destination: result.snapshot.id,
        identityRevision: result.snapshot.identityRevision,
      }),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
  }
  const result = await context.runtime.withdrawals.revealPayment(
    context.owner,
    parsed.id,
    parsed.reason,
    context.access,
  );
  return {
    bank: vault.open(result.ciphertext, {
      member: result.withdrawal.memberId,
      destination: result.snapshot.id,
      identityRevision: result.snapshot.identityRevision,
    }),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };
}

export async function commercialIdentityWebhook(
  raw: Uint8Array,
  headers: Headers,
) {
  const runtime = await installedRuntime();
  if (!runtime) throw new Error("Identity callback processing is unavailable");
  const provider = identityProvider(runtime.withdrawals.environment);
  const event = provider.verifyWebhook(raw, headers);
  await runtime.withdrawals.refreshIdentity(
    event.memberId,
    { eventId: event.replayId, expectedApplicantId: event.providerApplicantId },
    async (binding) =>
      (
        await provider.fetchIdentity(
          event.memberId,
          binding.providerApplicantId ?? event.providerApplicantId,
        )
      ).evidence,
    async (tx) => {
      // Provider authentication has already succeeded. This callback grants no
      // customer session/role and cannot initiate a withdrawal or bank payment.
      const [binding] =
        await tx`select member_id from commercial_billing.withdrawal_identity_bindings where member_id=${event.memberId} and external_user_id=${`docked:${runtime.withdrawals.environment}:${event.memberId}`} and provider_environment=${event.providerEnvironment}`;
      if (!binding)
        throw new CommercialWithdrawalRejected(
          "Identity callback has no enrolled member binding.",
        );
    },
  );
  return { received: true };
}

export type MemberWithdrawalPageData = Awaited<
  ReturnType<typeof memberWithdrawalView>
>;
export type OwnerWithdrawalPageData = Awaited<
  ReturnType<typeof ownerWithdrawalView>
>;
