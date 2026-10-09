import {writeFileSync,readFileSync} from 'node:fs';
const put=(p,s)=>writeFileSync(p,s);
const edit=(p,fn)=>put(p,fn(readFileSync(p,'utf8').replace(/\r\n/g,'\n')));
put('src/app/[section]/page.tsx', `import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiForm, Field } from '@/components/forms';
import { AppAuthShell } from '@/components/app-auth-shell';
export const metadata = { title: 'Docked account and support', robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: {
 params: Promise<{ section: string }>; searchParams: Promise<Record<string,string|undefined>>;
}) {
 const {section} = await params; const query = await searchParams;
 const redirects: Record<string,string> = {login:'/app/login',join:'/app/signup',recover:'/app/forgot-password','reset-password':'/app/reset-password',terms:'/beta-policies#terms',privacy:'/beta-policies#privacy','safer-gambling':'/beta-policies#responsible-gambling'};
 if(redirects[section]) redirect(redirects[section]);
 if(section === 'mfa') return <AppAuthShell><h1>Protect your account</h1><p>Sign in first. Privileged operations require a verified MFA session.</p><ApiForm endpoint="/api/auth" action="mfa_enroll" submit="Set up authenticator"><p>Keep your authenticator secret private.</p></ApiForm><ApiForm endpoint="/api/auth" action="mfa_verify" submit="Verify MFA"><Field label="Factor ID" name="factorId" required /><Field label="Six-digit code" name="code" required /></ApiForm><Link href="/dashboard">Account settings</Link></AppAuthShell>;
 if(section === 'unsubscribe') return <AppAuthShell><h1>Pause optional messages</h1><ApiForm endpoint={'/api/unsubscribe?token='+encodeURIComponent(query.token??'')} action="unsubscribe" submit="Pause all optional messages"><p>Necessary account notices are separate from optional communications.</p></ApiForm></AppAuthShell>;
 if(!['about','contact','legacy-support'].includes(section)) notFound();
 return <AppAuthShell><h1>{section==='about'?'Collect. Build. Compete.':'Docked support'}</h1><p>Docked is a fantasy sports card platform. Collect limited cards, build teams and compete. Football is the first playable sport; additional sports are not yet available.</p><p>Protected Preview uses fictional players and simulated scoring. Public registration is closed. No paid packs or cash prizes.</p>{section==='legacy-support' && <p>Support for previous physical-product orders and warranties remains separate. Please include your order reference; never send payment details or passwords.</p>}<p><a href="mailto:support@docked.com.au">support@docked.com.au</a></p><Link href="/">Docked home</Link></AppAuthShell>;
}
`);
put('src/app/dashboard/page.tsx', `import Link from 'next/link';
import { identity } from '@/server/auth';
import { config } from '@/server/config';
import { ApiForm, Field } from '@/components/forms';
import { AppShell } from '@/components/app-shell';
import { AppHeading, AccessGate } from '@/components/community-basics';
export const dynamic='force-dynamic';
export const metadata={title:'Account settings',robots:{index:false,follow:false}};
export default async function Dashboard(){
 const settings=config();const who=settings.database&&settings.auth?await identity():null;
 return <AppShell authenticated={!!who}><div className="app-settings"><AppHeading eyebrow="YOUR ACCOUNT" title="Settings & privacy" />{!who?<AccessGate configured={settings.database&&settings.auth} />:<>
 <nav className="tab-nav" aria-label="Account settings"><Link href="/fantasy/profile">My profile</Link><Link href="/profile#edit">Community profile</Link><Link href="/app/onboarding">Sports & preferences</Link><Link href="/notifications">Notifications</Link><Link href="/mfa">MFA settings</Link><Link href="/api/member">Export account data</Link><Link href="/contact">Help & support</Link></nav>
 <section className="app-panel"><h2>Account controls</h2><p>Deletion revokes access and sessions. Minimal ownership, consent and audit evidence is retained under the reviewed privacy policy. Download your export first.</p><ApiForm endpoint="/api/member" action="delete" submit="Delete my account"><Field label="Type DELETE to confirm" name="confirm" required /></ApiForm><ApiForm endpoint="/api/auth" action="logout" submit="Log out all sessions"><span /></ApiForm></section>
 </>}</div></AppShell>;
}
`);
put('src/app/admin/page.tsx',`import Link from 'next/link';
import { requireRole } from '@/server/auth';
import { AppAuthShell } from '@/components/app-auth-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Fantasy operations',robots:{index:false,follow:false}};
export default async function Admin(){
 try{await requireRole(['owner','admin','analyst','editor','auditor']);}catch{return <AppAuthShell><h1>Verified staff access required</h1><p>Assigned permissions and MFA are required.</p><Link href="/app/login">Sign in</Link></AppAuthShell>;}
 return <AppAuthShell><h1>Fantasy operations</h1><nav aria-label="Operations"><p><Link href="/fantasy/admin">Card and competition administration</Link></p><p><Link href="/admin/community">Community moderation</Link></p><p><Link href="/admin/analytics">Acquisition and retention</Link></p></nav><p>Each workspace enforces its own permissions. Gameplay activation remains separately gated.</p></AppAuthShell>;
}
`);
edit('src/app/api/status/route.ts',s=>s.replace('import { serviceStatus } from "@/server/queries";\n','').replace('await serviceStatus()',"{ product: 'fantasy-cards', registration: 'closed' }"));
edit('src/core/preview-testers.ts',s=>s.replace('officialEdges: z.boolean()','officialEdges: z.literal(false).default(false)'));
edit('src/server/community-social.ts',s=>s.replace('where private.social_post_visible(${profileId},p.id)',"where private.social_post_visible(${profileId},p.id) and p.official_tip_id is null and p.community_edge_id is null and p.kind in ('discussion','analysis','question','celebration')"));
edit('src/app/compose/page.tsx',s=>s.replace(/import \{ previewTesterCapabilities[^\n]*\n/,'').replace(/  const previewCapabilities[^\n]*\n/,'').replace('Create a post or Edge','Create a post').replace('Share a perspective. Own the record.','Share your fantasy sport.').replace('A social post starts a discussion. An Edge becomes a permanent,\n        structured pre-event record.','Talk cards, teams and sport with the community.').replace('publishing a post or\n              permanent Edge.','publishing a post.').replace(/            previewFixtures=\{[\s\S]*?\}\n/,''));
edit('src/app/app/page.tsx',s=>s.replace(/import \{ fantasyPlatformEnabled[^\n]*\n/,'').replace('fantasyEnabled()\n        ? "/fantasy/play"\n        : "/edges"','"/fantasy/play"'));
edit('src/app/api/member/route.ts',s=>{
 s=s.replace(/import \{ publicTips[^\n]*\n/,'').replace(/import \{ DateTime[^\n]*\n/,'').replace(/import \{ recordAnalytics[^\n]*\n/,'');
 const a=s.indexOf('const preferenceSchema');const b=s.indexOf('export async function GET');s=s.slice(0,a)+s.slice(b);
 const c=s.indexOf('    if (body.action === "preferences")');const d=s.indexOf('    if (body.action === "delete")',c);s=s.slice(0,c)+`    if (['preferences','save','personal'].includes(body.action)) return NextResponse.json({error:'This account workflow has been retired. Use app onboarding for sport preferences.'},{status:410});\n`+s.slice(d);return s;
});
