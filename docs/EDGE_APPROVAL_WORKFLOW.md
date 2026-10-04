# Candidate review and approval

## Phase 5B current workflow

Sporting data → independent model → committed prediction → separate current Market Reference → candidate → **owner/admin MFA review** → paper or official publication, subject to purpose-specific approval. Neither analysts nor members can approve/reject through the new workflow. Manual forms provide canonical IDs and reasons, never numerical overrides. All eligible sporting events in frozen decision windows are evaluated, including those without a market; only qualifying comparisons enter the candidate queue.

Approval reloads the original prediction and revalidates version, code, input cutoff, current source/reference, minimum/EV, scheduled event, region and provider authority. Changing numerical evidence requires an audited new version/calculation, not editing a candidate. A moved/stale price invalidates or expires the candidate without deleting its evidence. The database independently enforces the lineage and one official Edge per event.

An independent strategy is registered inactive through the private models API (`create_policy`), explicitly reviewed (`approve_policy`), and separately activated (`set_policy_active`). Model registration/transition uses `create`/`transition`; all actions are bounded, same-origin, rate-limited and owner/admin MFA protected. Configuration values are supplied only for versioned model/strategy governance, not prediction overrides. No policy, fitted estimator or activation is seeded in this release.

No historical betting ROI gate applies to this new path. Official live approval starts the forward-only record; research and paper never enter it. Auto-publication and external candidate notifications remain off. The earlier market-baseline workflow below is retained as superseded research context.

The candidate queue is private research evidence. It does not populate public Edge feeds, official performance, community ledgers or Top Docked. Rejected and losing evidence is not deleted.

1. A durable scheduled or explicit staff job reads approved canonical events/markets and retained current observations.
2. The same versioned reference/pricing engine used by prospective operation applies source independence, classification, freshness, disagreement, decision window, odds range, minimum edge and deterministic selection ordering.
3. An immutable candidate captures event/market/selection, strategy hash and code commit, reference ID/hash, source snapshots, model provenance, probability/fair/minimum odds, EV, purpose, timestamps and expiry. The model remains labelled unvalidated research baseline.
4. Owner/admin/analyst MFA may request a review. Auditor is read only. Manual creation supplies canonical IDs and a reason, never odds/probability. A requested selection must be the engine's highest-ranked qualifying selection; analysts cannot bypass its one-selection ordering.
5. Approve reloads current canonical data and reruns the same evaluator. SQL independently rechecks actor/session/ban, strategy/lifecycle/hash, current code, current source/config/region authority, event status, decision window, freshness, reference price, minimum price and EV. Expired/moved/invalid candidates remain retained and receive EXPIRED or INVALIDATED review evidence.
6. Research approval appends APPROVED evidence only. It creates no sporting publication or performance record. Paper approval can use the existing immutable publication routine only after every paper lifecycle and runtime/database flag passes. Live publication additionally requires a genuinely validated model; the installed baseline cannot pass that gate even if strategy flags are approved.

Statuses are CANDIDATE, NEEDS_REVIEW, APPROVED, REJECTED, EXPIRED and INVALIDATED. All reviews are append-only. Terminal decisions cannot be rewritten. A unique approved decision and the existing canonical publication uniqueness constraints prevent double publication. Repeated API approval of an already-approved candidate returns its existing linkage.

Rejection categories are data concern, market moved, model concern, duplicate, market-rule concern, editorial/operational and other. A reason is required and retained. Staff must use them honestly; editorial rejection must not disguise selective removal of losing evidence.

The queue sorts by immutable scan timestamp and UUID tie-breaker with bounded keyset pagination. An expired source cannot be made current by revisiting the page or retrying a request. Manual jobs lose authority if their originating session, role, account or profile is revoked before execution.

No approval action changes a strategy configuration, grants rights, enables a region, activates a provider, clears a source outage, enables sending or turns on automatic publication. A material strategy/configuration change requires a new version and evidence review. Held-out results never authorize silent tuning.

Activation remains blocked on licensed current and historical data, authorized results coverage, reviewed ordinary jurisdiction permissions, configured independent source cohorts, reviewed research evidence and an explicitly enabled bounded worker schedule. Software-generated EV alone satisfies none of these approvals.
