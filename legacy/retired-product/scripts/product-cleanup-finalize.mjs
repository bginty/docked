import {readFileSync,writeFileSync} from 'node:fs';
const edit=(p,fn)=>writeFileSync(p,fn(readFileSync(p,'utf8').replace(/\r\n/g,'\n')));
edit('src/components/app-auth-forms.tsx',s=>s.replace('            .filter(([key]) => !fantasyPreview || key !== "officialEdges")\n',''));
edit('src/components/app-auth-shell.tsx',s=>s.replace(/import \{ BrandLogo[^\n]*\n/,'').replace(/import \{ fantasyPresentationEnabled[^\n]*\n/,'').replace('{fantasyEnabled() ? <FantasyLogo /> : <BrandLogo surface="dark" />}','<FantasyLogo />'));
edit('src/components/brand-logo.tsx',s=>s.replace('import { brandAssets } from "@/brand/brand";','import { fantasyAssets } from "@/brand/fantasy-assets";').replace('/** The installed Android icon is the master. Never substitute a legacy D variant. */','/** Use supplied image assets, including the wordmark. */').replace('src={brandAssets.mark}','src={mark ? fantasyAssets.icon512 : fantasyAssets.compact}').replace('width={1024}','width={mark ? 512 : 400}').replace('height={1024}','height={mark ? 512 : 100}').replace(/      \{!mark && \([\s\S]*?\)\}\n/,''));
edit('src/app/beta-policies/page.tsx',s=>s.replace('import { notFound } from "next/navigation";\n','').replace('import { betaPolicyVersions } from "@/core/hosted-beta.mjs";\n','').replace('  if (process.env.DOCKED_BETA_STAGING !== "true" || !betaPolicyVersions())\n    notFound();\n','').replace('preserved in the approved text. External admission is still closed.','preserved in the approved text. Previous research and betting product references are historical; the current product is fantasy sports cards. External admission is still closed.'));
edit('src/app/fantasy/[tab]/page.tsx',s=>s.replace(' ||\n    !fantasyEnabled()','').replace('  let data;','  if (!fantasyEnabled()) return <div className="fantasy-gate"><h1>Fantasy Cards</h1><p>{fantasyTagline}</p><p>Gameplay is not enabled in this protected Preview. Public registration is closed.</p><Link className="button" href="/app">Account access</Link><p><Link href="/">Docked home</Link></p></div>;\n  let data;'));
edit('scripts/build-mobile-shell.mjs',s=>s.replace(/const canonical = JSON.parse\([\s\S]*?\);\n/,'').replace('const fantasy = process.env.FANTASY_CARDS_PREVIEW === "true" || liveBeta;','const fantasy = true;').replace('fantasy ? "public/brand/docked/icons/docked-icon-512.png" : canonical.source','"public/brand/docked/icons/docked-icon-512.png"'));
edit('src/app/sports/page.tsx',()=>`import Link from 'next/link';
import { sports } from '@/content/sports';
import { AppAuthShell } from '@/components/app-auth-shell';
export const metadata={title:'Sports'};
export default function Sports(){return <AppAuthShell><h1>Choose your sport</h1><p>Football fantasy cards are implemented in Preview. Other sports currently support community discussion only.</p><nav aria-label="Sports">{sports.map(s=><p key={s.slug}><Link href={'/sports/'+s.slug}>{s.title}</Link></p>)}</nav><Link href="/app/onboarding">Save sport preferences</Link></AppAuthShell>;}
`);
edit('src/app/sports/[sport]/page.tsx',()=>`import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sports } from '@/content/sports';
import { AppAuthShell } from '@/components/app-auth-shell';
export default async function Sport({params}:{params:Promise<{sport:string}>}){const {sport}=await params;const item=sports.find(s=>s.slug===sport);if(!item)notFound();return <AppAuthShell><h1>{item.title}</h1><p>{sport==='football'?'Football fantasy cards use fictional players and simulated scoring in Preview.':'Fantasy gameplay for this sport is not available yet.'}</p>{sport==='football'&&<p><Link href="/fantasy/play">Football cards & competitions</Link></p>}<p><Link href={'/feed?sport='+sport}>Community discussion</Link></p><Link href="/sports">All sports</Link></AppAuthShell>;}
`);
edit('src/app/competitions/page.tsx',()=>`import {redirect} from 'next/navigation';
export default function Competitions(){redirect('/fantasy/play');}
`);
edit('next.config.ts',s=>s.replace(/    "\/api\/community-edges\/share": \[[\s\S]*?\],\n/,'').replace(/"\.\/public\/brand\/canonical\/docked-social.png"/g,'"./public/brand/docked/social/docked-open-graph-1200x630.jpg"'));
