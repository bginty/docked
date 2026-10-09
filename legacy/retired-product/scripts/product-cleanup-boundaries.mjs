import {readFileSync,writeFileSync} from 'node:fs';
const edit=(p,f)=>writeFileSync(p,f(readFileSync(p,'utf8').replace(/\r\n/g,'\n')));
edit('src/core/hosted-preview.ts',s=>{
s=s.replace('import { marketDataEnvironment } from "./market-data-environment";\n','');
const a=s.indexOf('  if (\n    env.MARKET_DATA_POLLING_ENABLED');const b=s.indexOf('  for (const name of [\n    "PREVIEW_AUTH_CAPTURE_MODE"',a);
s=s.slice(0,a)+`  if (env.MARKET_DATA_POLLING_ENABLED === 'true' || env.THE_ODDS_API_KEY?.trim() || env.ODDSPAPI_API_KEY?.trim()) fail();\n`+s.slice(b);return s;
});
edit('src/core/native-navigation.ts',s=>{
s=s.replace(/^const record =[^\n]*\n/m,'').replace(/^const research =[^\n]*\n/m,'').replace('(posts|edges)','(posts)');
for(const p of ['points','my-edge','edges','top-docked','results','methodology','membership'])s=s.replace(`  "/${p}",\n`,'');
s=s.replace('  "/app",','  "/fantasy/play", "/fantasy/cards", "/fantasy/market", "/fantasy/social", "/fantasy/profile",\n  "/app",');
s=s.replace('  const official = route.match(record);\n  if (official) return `/tips/${official[2]}`;\n','').replace('  if (research.test(route)) return route;\n','').replace(' ||\n    /^\\/learn\\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route)','');
for(const t of ['official_edge','edge_status','followed_member_edge','leaderboard'])s=s.replace(`  "${t}",\n`,'');return s;
});
edit('public/sw.js',s=>s.replace(/const CACHE=[^\n]*/,'const CACHE="docked-public-offline-fantasy-cleanup-v2";').replace(/const OFFLINE=[^\n]*/,'const OFFLINE="/brand/docked/offline.html";').replace(/^const fantasy=[^\n]*\n/m,'').replace(/^const freePlay=[^\n]*\n/m,''));
edit('src/core/analytics.ts',s=>{
const retired=['bookmaker_selected','edge_viewed','tip_saved','methodology_viewed','results_viewed','article_viewed','community_edge_started','community_edge_submitted','community_edge_rejected','community_price_moved','community_promo_excluded','leaderboard_viewed','pro_viewed','deal_viewed'];
for(const e of retired){s=s.replaceAll(`  "${e}",\n`,'');s=s.replace(new RegExp('  if \\([^\\n]+\\) return "'+e+'";\\n','g'),'');}
return s.replace('if (path === "/home" || path === "/community")','if (["/home", "/community", "/feed", "/fantasy/social"].includes(path))');
});
edit('src/content/sports.ts',s=>{
const items=[...s.matchAll(/slug: "([^"]+)",\n    title: "([^"]+)"/g)].map(m=>({slug:m[1],title:m[2]}));
return `/** Sport choices are not a claim of implemented fantasy scoring for each sport. */\nexport const sports = ${JSON.stringify(items,null,2)} as const;\nexport type SportSlug = typeof sports[number]['slug'];\n`;
});
edit('.env.example',s=>s.split('\n').filter(l=>!/^#/.test(l)&&!/(?:ODDS|MARKET_DATA|MARKET_REFERENCE|RESEARCH_AUTOMATION|SCANNER|FORWARD_PAPER|PUBLICATION_ENABLED|AUTO_PUBLISH|RESULTS_PROVIDER|RESULTS_API|RESULTS_RIGHTS)/.test(l)).join('\n'));
edit('scripts/android-debug.mjs',s=>{
const a=s.indexOf('const hostedFilename =');const b=s.indexOf('preserveAndroidApks(artifactDelivery',a);return s.slice(0,a)+`const hostedFilename = liveBeta ? 'Docked-Protected-Beta-v10-Fantasy-Cards.apk' : 'Docked-Preview-v10-Fantasy-Cards.apk';\n`+s.slice(b);
});
edit('tests/platform/native-offline.test.ts',s=>s.replaceAll('public/brand/icons/docked-app-icon-1024.png','public/brand/docked/icons/docked-icon-512.png'));
// Preserve notification rate-limit coverage; retired provider/Edge assertions live in the archive.
edit('tests/platform/transaction-boundaries.test.ts',s=>{
s=s.slice(0,s.indexOf('test("reserved provider ingestion'));
s=s.replace('notification and Edge actions','notification actions');
const a=s.indexOf('    [\n      "src/server/community-edges.ts"');const b=s.indexOf('  ] as const)',a);if(a>=0)s=s.slice(0,a)+s.slice(b);return s;
});
