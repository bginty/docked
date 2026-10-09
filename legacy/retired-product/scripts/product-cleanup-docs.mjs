import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const put=(p,s)=>writeFileSync(p,s);const get=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n');
put('README.md',`# Docked — Fantasy Sports Cards

**COLLECT. BUILD. COMPETE.** Docked is a multi-sport fantasy card platform. The permanent product authority is [PRODUCT_DIRECTION](docs/PRODUCT_DIRECTION.md).

The current implementation offers fictional football cards, limited editions, collections, team selection, simulated competitions, rankings and isolated Preview transactions. Other sports currently support community discussion/preferences; their fantasy gameplay is not operational.

Use the existing branch and supplied assets. Preserve authentication, MFA, invitation gates, ownership integrity and server-side transactions. Rarity never multiplies fantasy scores.

## Run and verify

Use the pinned Node dependencies: npm ci; npm run typecheck; npm run lint; npm test; npm run db:test; npm run test:browser; npm run build. Local database tests create isolated fixtures. Never use a production database as a test database.

See [BUILD_STATUS](docs/BUILD_STATUS.md), [cleanup plan](docs/FANTASY-CLEANUP-PLAN.md), [database retirement](docs/DATABASE_RETIREMENT.md) and [brand integration](docs/BRAND-INTEGRATION.md). Previous product source and instructions are historical in legacy/retired-product and cannot authorize restoring retired features.

Deploy only to protected Preview. Public registration, external admission, public launch and paid services stay closed. Keep the production holding page unchanged. Credentials belong only in ignored private files or the scoped host secret store.
`);
put('docs/BUILD_STATUS.md',`# Docked fantasy product status

Updated 10 October 2026. [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. Earlier build reports are archived in ../legacy/retired-product/docs/BUILD_STATUS.md.

This milestone retires the previous product and reviews fantasy functionality/design. Current implementation: fictional football cards, permanent finite editions, ownership history, pack issuance/opening, team selection, simulated competition scoring/rankings, and isolated Preview marketplace/trades. Production-compatible free play disables marketplace transfers. Further sport modules are not operational.

Public registration and external tester admission remain closed. Protected hosted beta currently authorizes owner authentication only; that is not gameplay acceptance. No production holding-page change, paid activation or public launch is authorized.

See FANTASY-CLEANUP-PLAN.md for work scope and FANTASY-CLEANUP-ACCEPTANCE.md for current verification evidence when available. Older QA reports are historical, not a pass for this milestone.
`);
put('docs/DECISIONS.md',`# Current Docked decisions

10 October 2026 — Permanent owner-approved direction: multi-sport fantasy sports cards. See PRODUCT_DIRECTION.md. All previous betting/odds/research-engine roadmaps are superseded. Historical decision records are retained under ../legacy/retired-product/docs/DECISIONS.md.

- Supplied fantasy artwork, COLLECT. BUILD. COMPETE., and Play / Cards / Market / Social / Profile are authoritative.
- Identity is always fantasy, independent of account/gameplay feature flags.
- Retired application routes are removed and old callers receive HTTP 410. Historical database records remain intact.
- Card identity, supply limits, provenance, idempotent transactions, ownership checks and concurrency controls are preserved. Rarity never changes fantasy scoring.
- Fictional football is the current gameplay scope; multi-sport remains the product architecture/direction, not fabricated functionality.
- Protected Preview only; registration/external admission and gameplay activation are unchanged. Owner sign-in does not authorize impersonating an owner session.
- Exact approved consent packets remain immutable. Superseded wording is identified; future replacements need versioned approval.
- Physical S24 testing and owner visual acceptance must be recorded separately from automated browser tests.
`);
put('src/brand/README_FOR_CODEX.md',`# Docked fantasy brand — active instructions

The permanent product is multi-sport fantasy sports cards. Tagline: **COLLECT. BUILD. COMPETE.** Read docs/PRODUCT_DIRECTION.md before changing branding.

Use the owner-supplied Website + Mobile Kit already integrated in public/brand/docked through fantasy-assets.ts. Header: compact supplied wordmark; app icon: supplied standalone mark; hero: supplied stadium responsive assets. Keep logos as image assets, preserve their aspect ratios and use dark surfaces for contrast. Do not redraw or reconstruct the wordmark in CSS.

Use the approved fantasy tokens in fantasy.css. No previous tagline, promotional banner or retired pricing interface belongs in the active app. The original instructions are archived unchanged in legacy/retired-product/src/brand/README_FOR_CODEX.md.
`);
// Clearly supersede historical instructions without rewriting their historical evidence.
for(const file of readdirSync('docs').filter(f=>f.endsWith('.md'))){
 if(['PRODUCT_DIRECTION.md','BUILD_STATUS.md','DECISIONS.md','DATABASE_RETIREMENT.md','FANTASY-CLEANUP-PLAN.md'].includes(file))continue;
 const p='docs/'+file,s=get(p);
 if(s.includes('Permanent fantasy product direction — 10 October 2026'))continue;
 const current=/FANTASY|BRAND-INTEGRATION|OWNER|BETA|POLIC|AUTH|EMAIL|MFA|GOOGLE_PLAY|ANDROID|PRODUCTION|LAUNCH/.test(file);
 const banner=current?'Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.':'Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.';
 put(p,`> ${banner}\n\n`+s.replace('Preserve legacy research routes and all odds/model workers, schemas and history.','Retire obsolete research routes and odds/model workers. Preserve historical schemas and audit evidence pending separately reviewed retirement.'));
}
