# Live Docked beta release policy

The owner authorised use of the existing live Docked site for future beta changes on 17 October 2026 (Australia/Sydney): “yes use live docked for future changes”. This replaces the earlier requirement to deploy these beta updates to the separate Preview environment.

- Site: https://docked.com.au (existing invited beta).
- Vercel project: `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`.
- Supabase project: `pojoymtniryarxxunyvz`.
- Restricted application role: `docked_beta_app`; existing beta schemas and admission remain authoritative.
- The separate Preview project is retained but is not required for this beta release path. No project deletion is authorised by this change.

This authorises tested application releases and reviewed additive migrations needed for them. It does not authorise arbitrary balance changes, ownership changes, database resets, test purchases on member accounts, new paid services, public registration, real payments, cash redemption, document collection or live trading settlement. Owner/staff MFA and ordinary-member access rules remain unchanged.

Release committed application files directly to Vercel. Do not push private source or local credentials to the public GitHub repository. Capture the existing domain/deployment rollback identity, review migrations and appropriate backup coverage, run relevant regressions, build a candidate without changing the live domains, verify it, then promote. A candidate is a production-target build awaiting domain assignment; it does not require a separate Preview database.

Never remove a hosted build guard to force a release. Vercel integration-generated privileged database/Auth credentials are not needed by the restricted web runtime and must be excluded from its deployment. Existing assets and financial feature restrictions must remain unchanged.

Release acceptance and commercial launch acceptance are different. A beta release may contain clearly restricted operations; do not describe unavailable workflows, untested physical devices, unlicensed feeds or disabled payments as complete.
