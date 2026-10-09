export const phase5cProject = "bckkllmndoxzpzdqrevb";
export const phase5cOrganization = "ernfnkcbalhyqpsrzdwa";
export const phase5cOrigin =
  "https://docked-preview-s24-briant-ginty.vercel.app";
export type Phase5cJournal = {
  runId: string;
  createdAt: string;
  baselineIds: string[];
  baselineHash: string;
  email: string;
  password: string;
  id?: string;
  factorId?: string;
  totpSecret?: string;
  accessToken?: string;
  erased?: boolean;
  memberOnly?: boolean;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function assertPhase5cAccount(
  j: Phase5cJournal,
  requireIdentity = true,
) {
  if (
    !uuid.test(j.runId) ||
    j.email !== `docked-phase5c-operator-${j.runId}@example.invalid` ||
    !Array.isArray(j.baselineIds) ||
    j.baselineIds.length !== 4 ||
    new Set(j.baselineIds).size !== 4 ||
    j.baselineIds.some((id) => !uuid.test(id)) ||
    !/^[a-f0-9]{64}$/.test(j.baselineHash) ||
    j.erased ||
    (requireIdentity && (!j.id || !uuid.test(j.id))) ||
    (j.id && j.baselineIds.includes(j.id))
  )
    throw Error("Disposable Phase5C scope denied");
}
export function assertPhase5cConnection(c: {
  projectRef: string;
  organizationId: string;
  supabaseUrl: string;
  databaseUrl: string;
}) {
  const u = new URL(c.databaseUrl);
  if (
    c.projectRef !== phase5cProject ||
    c.organizationId !== phase5cOrganization ||
    c.supabaseUrl !== `https://${phase5cProject}.supabase.co` ||
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    u.hostname !== "aws-0-ap-southeast-2.pooler.supabase.com" ||
    u.port !== "5432" ||
    decodeURIComponent(u.username) !== `postgres.${phase5cProject}` ||
    u.pathname !== "/postgres"
  )
    throw Error("Exact Docked Preview connection required");
}
