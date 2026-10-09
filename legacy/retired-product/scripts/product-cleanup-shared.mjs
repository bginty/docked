import { readFileSync, writeFileSync } from 'node:fs';
const get=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const put=(p,s)=>writeFileSync(p,s);
const edit=(p,fn)=>put(p,fn(get(p)));
edit('src/components/social-composer.tsx', s=> {
 s=s.replace(/import \{ (EdgeComposer|PreviewEdgeComposer) \}[^\n]*\n/g,'').replace('  previewFixtures = false,\n','');
 const a=s.indexOf('  const [mode,'); const b=s.indexOf('[body, setBody]',a); s=s.slice(0,a)+'  const '+s.slice(b);
 const c=s.indexOf('      <div className="community-tabs"'); const d=s.indexOf('        <div className="app-panel">',c); s=s.slice(0,c)+s.slice(d);
 s=s.replace('      )}\n    </div>','    </div>');
 const e=s.indexOf('            <label className="check">'); const f=s.indexOf('            {mediaIds.length',e); s=s.slice(0,e)+s.slice(f);
 s=s.replace('promotional: d.get("promotional") === "on",','promotional: false,').replace('Image quarantined for moderation. It does not verify a price or result.','Image submitted for moderation.').replace('Social post published. It is excluded from verified performance.','Social post published.').replace('Discussion is social content, not a verified performance record.','Talk cards, teams and sport with the community.').replace('proof of verified odds.','visible until approved.').replace('Uploads are quarantined and reviewed before display. No OCR or\n                screenshot can override provider prices, verify a record or\n                settle it.','Uploads are reviewed before display. Remove personal information before uploading.');
 return s;
});
edit('src/components/member-profile.tsx',s=>{
 s=s.replace(/import \{ listCommunityEdges \}[^\n]*\n/,'').replace(/import \{ profilePerformanceBundle \}[^\n]*\n/,'').replace(/import type \{ RankingPeriod \}[^\n]*\n/,'').replace(/import \{\s*PerformanceMetrics,[\s\S]*?from "\.\/community-performance";\n/,'');
 s=s.slice(0,s.indexOf('const periods:'))+s.slice(s.indexOf('export async function MemberProfile'));
 const a=s.indexOf('  const period =');const b=s.indexOf('  const graphDirection',a);s=s.slice(0,a)+'  const period = "all";\n'+s.slice(b);
 const c=s.indexOf('          {p.isOfficial ? (',s.indexOf('aria-label="Profile sections"'));const d=s.indexOf('          {graph && (',c);s=s.slice(0,c)+s.slice(d);
 const e=s.indexOf('          <section id="records">');const f=s.indexOf('          <section id="posts">',e);s=s.slice(0,e)+s.slice(f);
 s=s.replace('            <a href="#performance">Performance</a>\n','').replace('            <a href="#records">Edges</a>\n','').replace('                <Link href="/dashboard#saved">Saved official tips</Link>\n','').replace('                <Link href="/membership">Membership</Link>\n','').replace('A transparent sporting record.','Your fantasy sports community.').replace('Social posts never enter verified performance.','Start a conversation about cards, teams or sport.');
 return s;
});
edit('src/app/feed/page.tsx',s=>s.replace(/import \{ reviewedResearch \}[^\n]*\n/,'').replace(/import \{ ReviewedResearchList \}[^\n]*\n/,'').replace('feed, research]','feed]').replace('    reviewedResearch({ limit: 3 }),\n','').replace(/                \{!query.cursor &&[\s\S]*?<ReviewedResearchList data=\{research\} compact \/>\s*\)\}/,''));
edit('src/components/community-feed.tsx',s=>s.slice(0,s.indexOf('export function FeedSidePanel'))+`export function FeedSidePanel() {
 return <aside className="app-side-column"><section className="app-panel"><h2>Build your team</h2><p>Explore your cards and available fantasy competitions. Card rarity never multiplies points.</p><Link href="/fantasy/play">Open Play</Link></section><section className="app-panel"><h2>Your collection</h2><p>Every card has a permanent serial and ownership history.</p><Link href="/fantasy/cards">View cards</Link></section></aside>;
}
`);
edit('src/components/app-member-screens.tsx',s=>{
 s=s.slice(0,s.indexOf('export async function PointsScreen'));
 s=s.replace('communityFeed, communityProfile','communityFeed').replace(/import \{ profilePerformanceBundle[^\n]*\n/,'').replace(/import \{ MySportPosts[^\n]*\n/,'').replace(/import \{\s*FollowingContent,[\s\S]*?from "\.\/app-member-ui";/,'import { FollowingContent } from "./app-member-ui";');return s;
});
// Keep shared UI helpers and Following, retire the unrelated rankings/profile implementations.
edit('src/components/app-member-ui.tsx',s=>{
 s=s.slice(0,s.indexOf('export function PointsContent'));
 const a=s.indexOf('export function MonthlyLeaderboard'); const b=s.indexOf('export function FollowingContent');
 const types=s.slice(a,b).match(/(?:export )?type FollowingMembers[\s\S]*?\n};/);
 s=s.slice(0,a)+(types?.[0] ?? 'type FollowingMembers = { profiles: SocialProfile[]; message: string; nextCursor: string | null };')+'\n'+s.slice(b);
 s=s.replace(/import type \{ CommunityPerformance[^\n]*\n/,'').replace(/import type \{ TopDockedBoard[^\n]*\n/,'').replace(/import \{ NativeAppSettings[^\n]*\n/,'').replace(/import \{ ApiForm[^\n]*\n/,'').replaceAll('href="/my-edge"','href="/profile"').replace('title="Follow people, sports and sources"','title="Follow people and explore sports"');return s;
});
edit('src/components/community-basics.tsx',s=>{
const a=s.indexOf('        Verified community Edges'); const b=s.indexOf('\n      </p>',a);return s.slice(0,a)+'        Card ownership and fantasy scores are recorded securely. Community posts do not change card ownership or scores.'+s.slice(b);
});
edit('src/components/social-interactions.tsx',s=>{
const a=s.indexOf('      {post.claimLabel ===');const b=s.indexOf('      <p className="social-body">',a);s=s.slice(0,a)+s.slice(b);
const c=s.indexOf('      {post.officialTipId &&');const d=s.indexOf('      {post.moderationStatus === "visible"',c);s=s.slice(0,c)+s.slice(d);return s.replace('"misleading_odds",','');
});
edit('src/components/notification-centre.tsx',s=>{
const a=s.indexOf('const preferences:');const b=s.indexOf('export function NotificationCentre');s=s.slice(0,a)+`const preferences: [keyof NotificationPreferences, string][] = [
 ['followedMembers', 'Followed member posts'], ['social', 'Comments, replies, reactions and followers'], ['inApp', 'Receive optional in-app notifications'],
];
`+s.slice(b);return s.replace('      email: false,','      officialEdges: false, researchUpdates: false, lineupUpdates: false, teamUpdates: false, leaderboard: false, competitions: false, dealsMarketing: false,\n      email: false,');
});
edit('src/core/community-social.ts',s=>{
for(const k of ['officialEdges','researchUpdates','lineupUpdates','teamUpdates','leaderboard','competitions','dealsMarketing']) s=s.replace(new RegExp(k+': z.boolean\\(\\)(.default\\(false\\))?'),k+': z.literal(false).default(false)');
return s.replace('promotional: z.boolean().default(false)','promotional: z.literal(false).default(false)');
});
edit('src/server/community-social.ts',s=>{
// Applied at both hydration and selection, so direct post IDs and search cannot restore retired records.
s=s.replace('from private.social_posts p where p.id=any(${ids})','from private.social_posts p where p.id=any(${ids}) and p.official_tip_id is null and p.community_edge_id is null and p.kind in (\'discussion\',\'analysis\',\'question\',\'celebration\')');
s=s.replace('join private.social_profiles a on a.id=p.author_id\n',"join private.social_profiles a on a.id=p.author_id\n");
// Enforce the social-only condition irrespective of caller options.
s=s.replace('${!options.communityOnly}', '${false}');
s=s.replaceAll('where n.recipient_id=${c.profileId}',"where n.type in ('comment','reply','reaction','follow','followed_post') and n.recipient_id=${c.profileId}");
return s;
});
edit('src/components/app-auth-forms.tsx',s=>s.replace('  const fantasyPreview = previewOnly || fantasyProduction;','  const fantasyPreview = true;\n  void previewOnly; void fantasyProduction;').replace('["edges", "Docked Edges"]','["edges", "Fantasy cards"]').replace('fantasyPreview ? "/fantasy/play" : "/edges"','"/fantasy/play"').replace('["officialEdges", "Official Docked Edges"],','').replace('officialEdges: preferences.officialEdges,','officialEdges: false,'));
edit('src/server/app-onboarding.ts',s=>s.replace('import { fantasyPlatformEnabled as fantasyEnabled } from "@/core/fantasy-production";\n','').replace('redirect: fantasyEnabled() ? "/fantasy/play" : "/edges"','redirect: "/fantasy/play"').replace('officialEdges: row.official_edges === true','officialEdges: false'));
edit('src/server/config.ts',s=>s.replace('publication: env.PUBLICATION_ENABLED === "true"','publication: false').replace('paper: env.FORWARD_PAPER_ENABLED === "true"','paper: false'));
