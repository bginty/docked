import {readFileSync,writeFileSync} from 'node:fs';
const edit=(p,f)=>writeFileSync(p,f(readFileSync(p,'utf8').replace(/\r\n/g,'\n')));
edit('src/server/community-social.ts',s=>{
 s=s.replaceAll("'reaction','follow','followed_post'", "'reaction','follower','followed_post'");
 const start=s.indexOf('  const category =',s.indexOf('export async function enqueueCommunityNotification'));
 const end=s.indexOf('  const target =',start);
 s=s.slice(0,start)+`  if (!['comment','reply','reaction','follower','followed_post'].includes(input.type)) return;
  const category = input.type === 'followed_post' ? 'followed_members' : 'social';
`+s.slice(end);
 s=s.replace("and (${false} or (p.official_tip_id is null and p.community_edge_id is null and p.kind in ('discussion','analysis','question','celebration') and not author.is_official))", "and p.official_tip_id is null and p.community_edge_id is null and p.kind in ('discussion','analysis','question','celebration') and not author.is_official");
 const old=s.indexOf('    // An old publication must not');const recipients=s.indexOf('    const recipients =',old);
 s=s.slice(0,old)+s.slice(recipients);
 s=s.replace('and (${job.official_tip_id !== null} and n.official_edges or ${job.official_tip_id === null} and n.followed_members and exists(select 1 from private.social_follows f where f.actor_id=p.id and f.target_id=${job.author_id} and f.notifications and f.created_at<=${job.created_at}))', 'and n.followed_members and exists(select 1 from private.social_follows f where f.actor_id=p.id and f.target_id=${job.author_id} and f.notifications and f.created_at<=${job.created_at})');
 s=s.replace('      const official = job.official_tip_id !== null;\n','');
 const a=s.indexOf('        type: official'),b=s.indexOf('        href:',a);
 s=s.slice(0,a)+`        type: 'followed_post',
        title: 'A member you follow shared a post.',
`+s.slice(b);
 s=s.replace('groupKey: job.kind === "status" ? "edge_status" : "followed_posts"', 'groupKey: "followed_posts"');
 return s;
});
edit('tests/platform/community-maintenance.test.ts',s=>s.replace('restricted runner opts out of all official and ledger fanout while default worker semantics stay unchanged','all runners exclude retired publication records from social fanout').replace('/\\$\\{!options\\.communityOnly\\} or \\(p\\.official_tip_id', '/p\\.official_tip_id').replace('not author\\.is_official\\)/','not author\\.is_official/'));
edit('src/proxy.ts',s=>s.slice(0,s.indexOf('export const config ='))+`export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)']};\n`);
const replacements=[['Reconnect to load your community, account and current prices. Private records and price observations are never stored in this offline shell.','Reconnect to load your cards, teams, test-credit balance and community. Private records are never stored in this offline shell.'],['Informational analysis. No guaranteed returns.','Fictional players. Test credits only.'],['Current prices and private content cannot be verified while offline.','Cards, teams and test-credit balances cannot be verified while offline.']];
for(const p of ['mobile/offline.template.html','mobile/pwa-offline.template.html'])edit(p,s=>replacements.reduce((x,[a,b])=>x.replaceAll(a,b),s));
edit('scripts/build-mobile-shell.mjs',s=>{const a=s.indexOf('  if (fantasy)\n'),b=s.indexOf('  if (liveBeta)',a);return s.slice(0,a)+s.slice(b);});
