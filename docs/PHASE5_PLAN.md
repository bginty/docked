# Phase 5 implementation plan

Scope: sections 1–68 of the owner's Phase 5 request, 4 October 2026. Continue `codex/docked-value-platform`; rollback tag `docked-before-phase5-2026-10-04` points to `7663490c0b9adee05d2a2cef5ea7ef1e587f1a27`. Working tree was clean before edits.

Baseline executed: typecheck, lint, **209 platform tests**, **97 PostgreSQL/RLS tests** passed. Private execution logs: `private-data/phase5/baseline-platform.log` and `baseline-database.log`. These are software tests, not provider trial evidence. No root/ancestor AGENTS.md was present.

1. Reuse existing provider, quota, Market Reference and research engines. Add rights-gated fixture/market ingestion and an as-of baseline ModelProvider; never infer source eligibility from a successful API response.
2. Reuse PostgreSQL durable jobs for configurable scanner scheduling, an audited research candidate queue, manual canonical candidate creation and fresh approval revalidation. Keep automatic publication disabled and existing live/paper activation gates intact.
3. Add versioned community Trending and weekly recognition with integrity/anti-gaming filters, plus factual Watchlist content. Integrate with the compact five-tab Edges experience and staff operational screens.
4. Recheck official provider terms, history and prices. Produce coverage/trial/quality/cost reports with missing measurements explicitly UNKNOWN. Acquisition requires a dedicated key, approved scope and budget; paid acquisition requires owner approval.
5. Review integration, run the full relevant suite/build/browser/accessibility/secret/security checks, inspect mobile/desktop, update Android/Play readiness and commit logical groups. Only isolated Docked Preview may be changed; no production, DNS, Oura or external email.

Existing official benchmark records, community immutability, original strategy parameters, held-out boundaries, MFA, deletion and jurisdiction controls remain invariants. Physical v5 installation/entry works according to the owner's current report; new Phase 5 checks must be reported separately from that evidence.
