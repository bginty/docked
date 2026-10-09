import {readFileSync,writeFileSync} from 'node:fs';
const edit=(p,f)=>writeFileSync(p,f(readFileSync(p,'utf8').replace(/\r\n/g,'\n')));
edit('scripts/community-maintenance.ts',s=>s.replace('../src/server/queue','../src/server/account-job'));
edit('src/core/native-navigation.ts',s=>s.split('\n').filter(l=>!/^    (official_edge|edge_status|followed_member_edge|leaderboard):/.test(l)).join('\n'));
edit('src/app/search/page.tsx',s=>{
s=s.replace(/import \{ readingRoom[^\n]*\n/,'').replace('data, articles]','data]').replace('    readingRoom(),\n','');
const a=s.indexOf('  const matchedArticles');const b=s.indexOf('  return (',a);s=s.slice(0,a)+s.slice(b);
const c=s.indexOf('          {matchedArticles.map');const d=s.indexOf('          {!data.profiles.length',c);s=s.slice(0,c)+s.slice(d);
return s.replace('Search visible members and discussions, sports and educational articles.','Search visible members, discussions and sports.').replace('`${s.title} ${s.description}`','s.title').replace('<p>{s.description}</p>','<p>Community discussion. Fantasy sport availability is shown on the sport page.</p>').replace('!matchedSports.length &&\n            !matchedArticles.length','!matchedSports.length');
});
edit('src/server/community-social.ts',s=>s.replace('where p.id=${id} and private.social_post_visible(${viewer},p.id) for update',"where p.id=${id} and p.official_tip_id is null and p.community_edge_id is null and p.kind in ('discussion','analysis','question','celebration') and private.social_post_visible(${viewer},p.id) for update"));
edit('tests/platform/analytics.test.ts',s=>s.replace('assert.equal(analyticsEvents.length, 37);',"assert.ok(analyticsEvents.includes('feed_viewed'));\n  assert.equal(analyticsInput.safeParse({event:'edge_viewed'}).success,false);").replace('event: "edge_viewed", ...extra','event: "feed_viewed", ...extra').replace('pageEvent("/learn/probability"), "article_viewed"','pageEvent("/learn/probability"), null').replace('  assert.equal(clientAnalyticsAllowed("community_edge_started"), true);\n','').replace('  assert.equal(clientAnalyticsAllowed("community_edge_submitted"), false);\n',''));
edit('scripts/build-app-icons.mjs',s=>{
s=s.replace('const fantasy = process.env.FANTASY_CARDS_PREVIEW === "true" || liveBeta;','const fantasy = true;');
const a=s.indexOf('  if (!fantasy) {'); const b=s.indexOf('\n  }',a);if(a>=0)s=s.slice(0,a)+s.slice(b+4);
s=s.replace(/const canonical = JSON.parse\([\s\S]*?\);\n/,'').replace('const pack = "public/brand";\n','').replace('  const master = fantasy\n    ? "public/brand/docked/icons/docked-icon-512.png"\n    : canonical.source;','  const master = "public/brand/docked/icons/docked-icon-512.png";');return s;
});
edit('.github/workflows/platform-checks.yml',s=>s.replace('branches: [codex/docked-value-platform]','branches: [pivot/fantasy-cards-preview-v1, codex/vercel-beta-review]').replace('          ODDS_API_KEY: DOCKED_BUILD_CANARY_ODDS_20261002\n','').replace('            docs/qa/phase2/','            docs/qa/fantasy-cleanup/'));
edit('package.json',s=>{const p=JSON.parse(s);p.scripts.test='tsx --test --test-concurrency=2 tests/platform/*.test.ts';p.scripts['db:test']='tsx --test --test-concurrency=2 tests/database/*.test.ts';return JSON.stringify(p,null,2)+'\n';});
