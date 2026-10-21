import type { SandboxState } from "./sport-sandbox";
import type { SlotSelection } from "./nfl-seven";
/** Entry remains authoritative after lock; a newer private draft is editable beforehand. */
export function sandboxSelections(
  entry: SandboxState["entries"][number] | undefined,
  draft: SandboxState["drafts"][number] | undefined,
  locked: boolean,
): SlotSelection[] {
  if (
    !locked &&
    draft &&
    (!entry || Date.parse(draft.updated_at) > Date.parse(entry.updated_at))
  )
    return draft.selections;
  return (
    entry?.snapshot.map((c) => ({ slot: c.slot, card: c.card_id })) ??
    draft?.selections ??
    []
  );
}
