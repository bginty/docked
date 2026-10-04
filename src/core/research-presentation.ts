import { phase5Hash } from "./phase5-hash";
import type { MatchResearchFile, ResearchFactType } from "./research-engine";
/** Deliberately a reviewed subset, never a claim that the underlying whole match file is complete. */
export function approvedResearchFile(
  file: MatchResearchFile,
  approvedIds: string[],
  required: ResearchFactType[],
  contentId: string,
  snapshotId: string,
): MatchResearchFile | null {
  const eligible = file.sections
    .flatMap((s) => s.facts)
    .filter(
      (f) => f.confidence !== "RUMOUR" && f.status !== "CONFLICTING_EVIDENCE",
    );
  if (
    !approvedIds.length ||
    !approvedIds.every((id) => eligible.some((f) => f.id === id))
  )
    return null;
  const sections = file.sections.map((section) => {
    const facts = section.facts
      .filter((f) => approvedIds.includes(f.id))
      .map((f) => ({
        ...f,
        corroboratingIds: f.corroboratingIds.filter((id) =>
          approvedIds.includes(id),
        ),
        conflictingIds: [],
      }));
    return {
      ...section,
      facts,
      status: facts.length
        ? ("AVAILABLE" as const)
        : ("DATA_NOT_AVAILABLE" as const),
    };
  });
  return {
    ...file,
    sections,
    factIds: sections.flatMap((s) => s.facts.map((f) => f.id)).sort(),
    missing: required.filter(
      (type) =>
        !sections.some((s) =>
          s.facts.some((f) => f.type === type && f.status === "VERIFIED"),
        ),
    ),
    status: "PARTIAL",
    snapshotHash: phase5Hash({
      scope: "APPROVED_CONTENT_SUBSET",
      contentId,
      snapshotId,
      sections,
    }),
  };
}
