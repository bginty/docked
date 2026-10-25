import { z } from "zod";
import type { Operator } from "./commerce-sandbox";
import type { RedemptionProgram } from "./redemption";

export const syntheticIdentityPolicy = {
  version: "synthetic-identity-v1",
  scope: "synthetic-only",
  maxBytes: 10 * 1024 * 1024,
  requirePhoto: true,
  retentionMs: null,
  verificationExpiresMs: 365 * 86400000,
  types: [
    {
      id: "licence",
      label: "Synthetic driver licence",
      photo: true,
      sides: ["front", "back"],
    },
    {
      id: "passport",
      label: "Synthetic passport",
      photo: true,
      sides: ["identity"],
    },
    {
      id: "secondary",
      label: "Synthetic secondary ID",
      photo: false,
      sides: ["front"],
    },
  ],
} as const;
export const identityCaseCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      revision: z.number().int().nonnegative(),
      legalName: z.literal("Synthetic Applicant"),
      dob: z.literal("1990-01-01"),
      documents: z.array(z.enum(["licence", "passport", "secondary"])).max(2),
    })
    .strict(),
  z
    .object({
      action: z.literal("submit"),
      revision: z.number().int().nonnegative(),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      member: z.string(),
      revision: z.number().int().nonnegative(),
      documentVersion: z.number().int().positive(),
      decision: z.enum(["VERIFIED", "MORE_INFORMATION", "REJECTED", "REVOKED"]),
      reason: z.string().trim().min(3).max(240),
      internalNote: z.string().max(1000),
      document: z.enum(["licence", "passport", "secondary"]).optional(),
      checklist: z
        .object({ name: z.boolean(), dob: z.boolean(), readable: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("access"),
      member: z.string(),
      revision: z.number().int().nonnegative(),
      documentVersion: z.number().int().positive(),
      file: z.string().max(160),
    })
    .strict(),
]);
export type IdentityCaseCommand = z.infer<typeof identityCaseCommand>;
export type IdentityFile = {
  id: string;
  digest: string;
  side: string;
  mime: "image/png" | "image/jpeg" | "application/pdf";
  bytes: number;
  scan: "clean" | "quarantined" | "rejected";
  synthetic: true;
};
export type IdentityDocument = { type: string; files: IdentityFile[] };
export type IdentityCase = {
  id: string;
  member: string;
  status:
    | "DRAFT"
    | "UNDER_REVIEW"
    | "MORE_INFORMATION"
    | "REJECTED"
    | "VERIFIED"
    | "REVOKED";
  revision: number;
  documentVersion: number;
  policy: string;
  legalName: string;
  dob: string;
  documents: IdentityDocument[];
  submittedAt?: number;
  reason?: string;
  replaceDocument?: string;
  snapshots: { version: number; documents: IdentityDocument[]; at: number }[];
  audit: {
    actor: string;
    at: number;
    action: string;
    version: number;
    reason?: string;
    internalNote?: string;
  }[];
};
export type IdentityNotice = {
  id: string;
  reference: string;
  submittedAt: number;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  nextAttempt: number;
  leaseUntil?: number;
  deliveryError?: string;
};
export type ManualIdentityState = {
  cases: Record<string, IdentityCase>;
  outbox: IdentityNotice[];
};
export function validateIdentityDocuments(documents: IdentityDocument[]) {
  if (
    documents.length !== 2 ||
    new Set(documents.map((d) => d.type)).size !== 2
  )
    throw Error(
      "Choose exactly two distinct forms of ID. Licence front and back count as one.",
    );
  const digests = new Set<string>();
  let photo = false;
  for (const d of documents) {
    const type = syntheticIdentityPolicy.types.find((t) => t.id === d.type);
    if (!type) throw Error("Document type not in the configured policy");
    photo ||= type.photo;
    if (
      d.files.length !== type.sides.length ||
      type.sides.some((side) => !d.files.some((f) => f.side === side))
    )
      throw Error("All required document sides must be uploaded");
    for (const f of d.files) {
      if (
        f.scan !== "clean" ||
        f.bytes < 1 ||
        f.bytes > syntheticIdentityPolicy.maxBytes ||
        !f.synthetic
      )
        throw Error("Document security checks incomplete");
      if (digests.has(f.digest))
        throw Error("The same file cannot satisfy two document requirements");
      digests.add(f.digest);
    }
  }
  if (syntheticIdentityPolicy.requirePhoto && !photo)
    throw Error("A photo ID is required by the configured test policy");
}
export function applyIdentityCase(
  p: RedemptionProgram,
  actor: Operator,
  ref: string,
  input: IdentityCaseCommand,
  now: number,
) {
  if (p.realDocumentsEnabled !== false || p.scope !== "local-fixtures-only")
    throw Error("Real identity documents are disabled");
  const c = identityCaseCommand.parse(input),
    staff = c.action === "review" || c.action === "access";
  if (
    staff &&
    (actor.role !== "reviewer" ||
      actor.aal !== "aal2" ||
      !p.staff[actor.id]?.includes("identity"))
  )
    throw Error("Identity reviewer permission and MFA required");
  if (!staff && actor.role !== "member") throw Error("Member action required");
  const member = staff ? c.member : actor.id;
  const state = (p.manualIdentity ??= { cases: {}, outbox: [] });
  let item = state.cases[member];
  if ((item?.revision ?? 0) !== c.revision)
    throw Error("This case changed. Refresh before continuing.");
  if (c.action === "save") {
    if (
      item &&
      !["DRAFT", "MORE_INFORMATION", "REJECTED", "REVOKED"].includes(
        item.status,
      )
    )
      throw Error("This case cannot be edited during review or after approval");
    item ??= {
      id: `KYC-${ref}`,
      member,
      status: "DRAFT",
      revision: 0,
      documentVersion: 0,
      policy: syntheticIdentityPolicy.version,
      legalName: c.legalName,
      dob: c.dob,
      documents: [],
      snapshots: [],
      audit: [],
    };
    item.documents = c.documents.map((type) => ({
      type,
      files: syntheticIdentityPolicy.types
        .find((t) => t.id === type)!
        .sides.map((side) => ({
          id: `fixture-${type}-${side}`,
          digest: `synthetic-${type}-${side}`,
          side,
          mime: "image/png",
          bytes: 1024,
          scan: "clean",
          synthetic: true,
        })),
    }));
    item.status = "DRAFT";
    item.reason = undefined;
    item.replaceDocument = undefined;
    state.cases[member] = item;
  } else if (!item) throw Error("Save your details first");
  if (!item) throw Error("Case unavailable");
  if (c.action === "submit") {
    if (item.status !== "DRAFT")
      throw Error("This case has already been submitted");
    validateIdentityDocuments(item.documents);
    item.documentVersion++;
    item.submittedAt = now;
    item.status = "UNDER_REVIEW";
    item.snapshots.push({
      version: item.documentVersion,
      documents: structuredClone(item.documents),
      at: now,
    });
    state.outbox.push({
      id: `${item.id}:${item.documentVersion}`,
      reference: item.id,
      submittedAt: now,
      status: "pending",
      attempts: 0,
      nextAttempt: now,
    });
  }
  if (c.action === "review" || c.action === "access") {
    if (item.documentVersion !== c.documentVersion)
      throw Error("Submitted document version changed");
    if (c.action === "review") {
      if (member === actor.id)
        throw Error("You cannot approve or review your own case");
      if (
        c.decision === "REVOKED"
          ? item.status !== "VERIFIED"
          : item.status !== "UNDER_REVIEW"
      )
        throw Error("Case is not available for this decision");
      if (
        c.decision === "VERIFIED" &&
        !Object.values(c.checklist).every(Boolean)
      )
        throw Error("Complete the review checklist");
      if (
        c.decision === "MORE_INFORMATION" &&
        !item.documents.some((d) => d.type === c.document)
      )
        throw Error("Identify the document requiring replacement");
      item.status = c.decision;
      item.reason = c.reason;
      item.replaceDocument =
        c.decision === "MORE_INFORMATION" ? c.document : undefined;
    } else if (
      !item.snapshots
        .at(-1)
        ?.documents.some((d) => d.files.some((f) => f.id === c.file))
    )
      throw Error("Document unavailable");
  }
  item.revision++;
  item.audit.push({
    actor: actor.id,
    at: now,
    action: c.action === "review" ? c.decision : c.action,
    version: item.documentVersion,
    ...(c.action === "review"
      ? { reason: c.reason, internalNote: c.internalNote }
      : {}),
  });
  if (c.action !== "access") {
    const identity = (p.identities[member] ??= {
      status: "NOT_STARTED",
      revision: 0,
      verifiedName: "Synthetic Applicant",
      timeline: [],
    });
    identity.status = item.status === "DRAFT" ? "NOT_STARTED" : item.status;
    identity.revision++;
    identity.verifiedName = item.legalName;
    identity.evidence = `manual:${item.id}:${item.documentVersion}`;
    identity.expires =
      item.status === "VERIFIED"
        ? now + syntheticIdentityPolicy.verificationExpiresMs
        : undefined;
    identity.timeline.push({
      actor: actor.id,
      at: now,
      status: identity.status,
      reason:
        c.action === "review"
          ? c.reason
          : "Synthetic verification case updated",
      policy: item.policy,
    });
  }
  return { reference: item.id, revision: item.revision, status: item.status };
}
export function identityCaseView(
  p: RedemptionProgram | undefined,
  actor: Operator,
  admin = false,
) {
  if (
    admin &&
    (actor.role !== "reviewer" ||
      actor.aal !== "aal2" ||
      !p?.staff[actor.id]?.includes("identity"))
  )
    throw Error("Identity reviewer permission required");
  const cases = Object.values(p?.manualIdentity?.cases ?? {})
    .filter((c) => admin || c.member === actor.id)
    .map((c) => ({
      ...c,
      audit: c.audit.map(({ internalNote, ...a }) =>
        admin ? { ...a, internalNote } : a,
      ),
    }));
  return {
    enabled: !!p?.enabled,
    syntheticOnly: true,
    policy: syntheticIdentityPolicy,
    cases,
    outbox: admin ? (p?.manualIdentity?.outbox ?? []) : [],
    admin,
  };
}
