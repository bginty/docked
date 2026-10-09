import { readFileSync,writeFileSync } from 'node:fs';
const get=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n');const put=(p,s)=>writeFileSync(p,s);const edit=(p,f)=>put(p,f(get(p)));
const q=get('src/server/queries.ts');
put('src/server/region-access.ts',`import 'server-only';
import { config } from './config';
import { db } from './db';
import { identity } from './auth';
import { previewCommunityPolicy } from './preview-community';
import { eligible, type RegionPolicy } from '@/core/policy';
`+q.slice(q.indexOf('export async function regionAccess'),q.indexOf('export async function publicTips')).replace('feature = "tips"','feature: string'));
edit('src/server/community-policy.ts',s=>s.replace('from "./queries"','from "./region-access"'));
put('src/app/community/page.tsx',`import {redirect} from 'next/navigation';
export default function Community(){redirect('/feed');}
`);
put('src/core/community-navigation.ts',`export const communityAdminSections = [['overview','Community overview'],['reports','Reports & moderation'],['integrity','Member integrity'],['notifications','Notifications'],['analytics','Social analytics']] as const;
`);
put('src/components/community-admin-page.tsx',`import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireRole} from '@/server/auth';
import {communityModeration} from '@/server/community-social';
import {AppShell} from './app-shell';
import {AppHeading,CommunityEmpty} from './community-basics';
import {ModerationPanel,AdminReadPanel} from './community-admin';
import {communityAdminSections} from '@/core/community-navigation';
export async function CommunityAdminPage({section}:{section:string}) {
 if(!communityAdminSections.some(([id])=>id===section))notFound();
 let staff;try{staff=await requireRole(['owner','admin','auditor','editor']);}catch{return <CommunityEmpty title="Verified staff access required">Staff role and MFA are required. <Link href="/app/login">Sign in</Link></CommunityEmpty>;}
 const audit=['owner','admin','auditor'].includes(staff.role);
 if(!audit&&['analytics','notifications'].includes(section))return <CommunityEmpty title="Additional permission required">Return to reports for moderation.</CommunityEmpty>;
 const moderation=['overview','reports','integrity'].includes(section)?await communityModeration():null;
 return <AppShell authenticated><AppHeading eyebrow="FANTASY COMMUNITY" title={communityAdminSections.find(([id])=>id===section)![1]}/><nav aria-label="Community operations">{communityAdminSections.filter(([id])=>audit||!['analytics','notifications'].includes(id)).map(([id,label])=><p key={id}><Link href={'/admin/community/'+id}>{label}</Link></p>)}</nav>{moderation&&(moderation.status==='ready'?<ModerationPanel data={moderation} canWrite={staff.role!=='auditor'}/>:<CommunityEmpty title="Moderation unavailable">{moderation.message}</CommunityEmpty>)}{audit&&section==='analytics'&&<AdminReadPanel endpoint="/api/admin/community-analytics" title="Observed social activity"/>}{audit&&section==='notifications'&&<AdminReadPanel endpoint="/api/admin/community-analytics?view=notifications" title="In-app notifications"/>}</AppShell>;
}
`);
edit('src/components/community-admin.tsx',s=>{
const a=s.indexOf('export function DisabledBenefitsDraft');if(a>=0)s=s.slice(0,a);
return s.replace('cannot change a locked Edge or its settlement. Corrections use the\n        separate integrity workflow.','cannot change card ownership, card scarcity or competition scores.');
});
edit('src/server/community-analytics.ts',s=>{
s=s.replace('import { dataHealth } from "./data-health";\n','').replace('    verification,\n    providerHealth,\n','');
s=s.replace(/    sql`select classification,[\s\S]*?    dataHealth\(\),\n/,'');
s=s.replace('moderation, notifications, verification','moderation, notifications').replace('    providerHealth,\n','');
s=s.replace(/,'community_edge_submitted'/g,'').replace(/'community_edge_submitted',/g,'').replace(/'community_edge_rejected','community_price_moved','community_promo_excluded',/g,'').replace(/,'leaderboard_viewed'/g,'');
s=s.replace(/\n      union all select 'leaderboard'[\s\S]*?private.leaderboard_notification_jobs`/,'`');
s=s.replace(' and 50 leaderboard recipients','').replace(' Classification observations are not member submission attempts.','');return s;
});
edit('src/app/app/onboarding/page.tsx',s=>s.replace(/import \{ fantasyPlatformEnabled[^\n]*\n/,'').replace('fantasyPlatformEnabled() ? "/fantasy/play" : "/edges"','"/fantasy/play"'));
edit('src/components/notification-centre.tsx',s=>s.replace('    body[key]','    body[key]'));
