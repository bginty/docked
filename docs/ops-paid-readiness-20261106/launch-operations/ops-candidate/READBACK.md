# Protected operations candidate

On 6 November 2026 AEDT, the existing Vercel project built an unassigned candidate for the reviewed operations backend changes. Its own URL requires Vercel authentication. The canonical site still serves the existing release.

| Item | Observed |
| --- | --- |
| Candidate deployment | `dpl_4mNaWxtLGQQ3ZXmewtABHHf2UcSK`, READY |
| Candidate source | `0e7085af174e503014dccf0f9fac0b3239cfc2dc` (local immutable branch `codex/closed-ops-candidate-20261106`) |
| Reviewed input | `88643e436f72aa674f40758c167ba7449309429b`, ten runtime paths copied by Git blob, listed in the verification record |
| Canonical parent and live source | `7319dddd1227b294fb38542cdee2044e01c89bd4` / `dpl_2YxdbcCi584D1zQPVmyewM8QPxiQ` |
| Build | Hosted guard, Next compile and type check completed; 863 archived Git blobs matched |
| Protection | Anonymous candidate request returned a 302 to `https://vercel.com/sso-api`; authorised Vercel access was used for the read-only application checks |
| HTTP verification | 16 candidate GETs and 5 live GETs passed; release identity, policy versions, login redirects and closed route responses checked |
| Runtime | Original nine activation gates remain false, with `DOCKED_BILLING_OPS_ALERTS` and `DOCKED_BILLING_OPS_SIGNALS` explicitly false. No temporary TEST transport. Existing private-beta flags and restricted connections retained. |
| Scheduled work | Vercel project API reports the canonical deployment as both active Production target and active cron deployment. Its only schedule is still `/api/store/google/scheduled` every five minutes, pointing to the canonical deployment host. The last cron update predates candidate creation. |

The archived source excludes the unbound Graph alert/delivery modules, native sources and private source data. The canonical Vercel configuration and published policy bytes are unchanged. No domains were promoted; no migrations, role grants, provider changes, worker calls or customer mutations were made. The candidate verifies a closed backend. It does not establish authenticated public gameplay, operational alert delivery or live billing acceptance.

See [source and route evidence](candidate-verified.json), [hosted build evidence](build-summary.json) and [runtime boundary](runtime-boundary.json).
