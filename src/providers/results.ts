import { hash, type Rules } from "@/core/pricing";
import type { Result } from "@/core/settlement";
import { resultSchema } from "@/research/dataset";
import type { ResultsProvider, ProviderStatus } from "./contracts";

export type ResultImportAuthority = {
  provider: string;
  rightsReference: string;
  enabled: boolean;
  allowedEventIds: readonly string[];
  dataHash: string;
  reviewedBy: string;
};
/** Canonical authorised-file boundary. No scraping, provider network or guessed outcomes. */
export class AuthorisedResultsImport implements ResultsProvider {
  readonly id: string;
  readonly authorised: boolean;
  readonly status: ProviderStatus;
  private readonly records: Result[];
  constructor(input: unknown, authority: ResultImportAuthority) {
    this.id = authority.provider;
    this.authorised = Boolean(
      authority.enabled &&
      authority.provider.trim() &&
      authority.rightsReference.trim() &&
      authority.reviewedBy.trim(),
    );
    this.status = !authority.provider.trim()
      ? "NOT_CONFIGURED"
      : this.authorised
        ? "READY"
        : "DISABLED";
    if (!this.authorised)
      throw new Error(
        `RESULTS_PROVIDER_STATUS=${this.status}; reviewed results rights required`,
      );
    if (hash(input) !== authority.dataHash)
      throw new Error("Results import hash mismatch");
    this.records = resultSchema.array().parse(input);
    const revisions = new Set<string>();
    for (const r of this.records) {
      if (
        !r.authorised ||
        r.source !== this.id ||
        !authority.allowedEventIds.includes(r.eventId) ||
        r.eventId !== r.rules.eventId
      )
        throw new Error("Results provider/event authorisation mismatch");
      const key = `${r.eventId}:${r.revision}`;
      if (revisions.has(key)) throw new Error("Duplicate result revision");
      revisions.add(key);
    }
    for (const r of this.records)
      if (
        r.supersedesRevision &&
        !this.records.some(
          (prior) =>
            prior.eventId === r.eventId &&
            prior.revision === r.supersedesRevision &&
            Date.parse(prior.observedAt) < Date.parse(r.observedAt),
        )
      )
        throw new Error("Correction must name an earlier retained revision");
    for (const eventId of authority.allowedEventIds) {
      const eventRecords = this.records
        .filter((r) => r.eventId === eventId)
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
      for (let i = 1; i < eventRecords.length; i++)
        if (eventRecords[i].supersedesRevision !== eventRecords[i - 1].revision)
          throw new Error("Ambiguous result revisions require manual review");
    }
  }
  async result(eventId: string, rules: Rules): Promise<Result | null> {
    const candidates = this.records
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    const latest = candidates[0];
    if (!latest) return null;
    if (hash(latest.rules) !== hash(rules))
      throw new Error("Result settlement rules mismatch");
    return structuredClone(latest);
  }
  revisions(eventId: string) {
    return structuredClone(this.records.filter((r) => r.eventId === eventId));
  }
}
