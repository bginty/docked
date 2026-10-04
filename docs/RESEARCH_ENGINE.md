# Governed research engine

Research is separate from market prices, model predictions and official/community performance. The current implementation has no fitted football estimator, no automatic probability recalculation executor and no authority to settle or publish betting records.

Staff can register versioned sources, enter the 17 supported structured fact types, compile an immutable prematch EPL research snapshot, and review an evidence-bound factual content draft. Facts use explicit canonical event/participant identity; a team label must exactly match a captured canonical participant. No guessed team slug or fuzzy mapping is applied. Rumours and unresolved conflicts cannot become published factual content or model inputs.

The source catalogue is reviewed preparation, not a database registration or activation. The shipped OpenFootball adapter only accepts two pinned, reviewed JSON resources. It retains source-reported research datasets separately; missing publication time, timezone, regulation finality and correction lineage remain unknown. Dataset scores do not become canonical results or model-training evidence automatically.

All new tables are private, use RLS and deny anonymous/authenticated browser access. The current restricted production `docked_app` role receives no new research authority. Research deployment on that role needs a separate reviewed least-privilege extension; it must not use a privileged database connection as a workaround. Preview's trusted server authenticates staff with current MFA and repeats role/session checks in SQL.

Member research requires the existing authenticated `community_social` jurisdiction gate plus current source public-display, commercial and retention rights for the member's actual country/state. Editorial approval never grants tips authority. Member DTOs include only approved facts and public attribution; they omit source review notes, raw payloads, internal reasons and unpublished fact identities. Approved subsets are labelled partial rather than claiming completeness of the entire research file.

Three independent in-app preferences—research, lineup and team updates—default off. This release stores those choices but does not create research notification fanout, email or push delivery.

Validation is split between pure injected-fetch tests, isolated PostgreSQL/PGlite operations and separately recorded hosted acceptance. Local synthetic fixtures are not genuine data, model validation or sporting performance.
