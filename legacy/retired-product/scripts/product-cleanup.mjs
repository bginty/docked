// One-time, local source migration. No database or network access.
import { readFileSync as read, writeFileSync as write } from 'node:fs';
const get = p => read(p, 'utf8');
const put = (p, s) => write(p, s);
let p='src/components/app-shell.tsx', s=get(p);
s=s.replace('import { BrandLogo } from "./brand-logo";\n','').replace('import { brand } from "@/brand/brand";\n','');
const start=s.indexOf('const nav:'); const end=s.indexOf('function useEditingViewport');
s=s.slice(0,start)+`const nav: { href: string; label: string; icon: AppIconName }[] = [
  { href: '/fantasy/play', label: 'Play', icon: 'trophy' },
  { href: '/fantasy/cards', label: 'Cards', icon: 'feed' },
  { href: '/fantasy/market', label: 'Market', icon: 'points' },
  { href: '/fantasy/social', label: 'Social', icon: 'community' },
  { href: '/fantasy/profile', label: 'Profile', icon: 'profile' },
];
export function appDestination(path: string) {
  if (/^\\/fantasy\\/(play|cards|market|social|profile)(\\/|$)/.test(path)) return path.split('/').slice(0,3).join('/');
  if (/^\\/(feed|following|community|compose|search)(\\/|$)/.test(path)) return '/fantasy/social';
  if (/^\\/(profile|dashboard|notifications)(\\/|$)/.test(path)) return '/fantasy/profile';
  return '/fantasy/play';
}

`+s.slice(end);
const a=s.indexOf('  const {\n    production,'); const b=s.indexOf('  const shell =',a);
s=s.slice(0,a)+`  const { production, liveBeta } = useEnvironmentPresentation();
  const activeNav = nav;
  const destination = appDestination(path);
`+s.slice(b);
s=s.replaceAll('href={fantasyNavigation ? "/fantasy/play" : "/edges"}','href="/fantasy/play"');
s=s.replace(/\{fantasyPreview \? \(\s*<FantasyLogo \/>\s*\) : \(\s*<BrandLogo surface="dark" decorative \/>\s*\)\}/g,'<FantasyLogo />');
s=s.replace(/\{!fantasyPreview && <p className="eyebrow">\{brand.tagline\}<\/p>\}/g,'');
s=s.replace(/\{liveBeta && fantasyProduction && \([\s\S]*?\)\}/g,'');
s=s.replace(/\{!fantasyPreview && \([\s\S]*?\)\}/g,'');
s=s.replace(/\{!fantasyPreview && <Link[^\n]*\}/g,'');
s=s.replace(/<p className="small-note">[\s\S]*?<\/p>/,'<p className="small-note">18+ · Fantasy Cards<br />Free play. No cash value.</p>');
s=s.replace(/<p className="app-footnote">[\s\S]*?<\/p>/,'<p className="app-footnote">Fictional players. No paid packs or cash prizes. Rarity never multiplies fantasy scores.</p>');
put(p,s);
p='src/app/page.tsx';s=get(p);
const fantasyStart=s.indexOf('    return ('); const legacyStart=s.indexOf('  const [status,');
s=`import Link from 'next/link';
import { FantasyHero, FantasyLogo } from '@/components/fantasy-brand';
export const metadata = { title: 'Fantasy sports cards', alternates: { canonical: '/' } };
export default function Home() {
  const production = false;
  const liveBeta = false;
`+s.slice(fantasyStart,legacyStart)+'}\n';
s=s.replace('FANTASY CARDS PREVIEW V1','FANTASY SPORTS CARDS · CLOSED PREVIEW').replace('Collect limited fictional player cards. Build your football team. Compete, buy, sell and trade using test credits.','Collect limited fictional player cards. Build teams and compete. Football is the first playable sport; other sports are not yet available.');
s=s.replace('Closed Preview for 2–3 testers. Fictional players, test credits and Preview/Test Prizes only.','Protected Preview. Public registration is closed. Gameplay access requires separate approval. Fictional players; no cash value.');
put(p,s);
p='src/app/layout.tsx';s=get(p);
const imports=s.slice(0,s.indexOf('export const metadata:')).replace('import Link from "next/link";\n','').replace('import "./phase5-edges.css";\n','').replace('import "./phase5c-research.css";\n','').replace(/import \{ headerAccountLabel \}[^\n]*\n/,'').replace(/import \{ SportIcon \}[^\n]*\n/,'').replace(/import \{ BrandLogo \}[^\n]*\n/,'').replace(/import \{\s*fantasyPresentationEnabled[\s\S]*?from "@\/core\/fantasy-production";\n/,'');
const body=s.slice(s.indexOf('    return (',s.indexOf('export default async function Layout')),s.indexOf('  return (',s.indexOf('    );',s.indexOf('export default async function Layout'))));
put(p,imports+`export const metadata: Metadata = {
  metadataBase: new URL(process.env.DOCKED_BETA_STAGING === 'true' ? betaOrigin(process.env) : process.env.DOCKED_HOSTED_REVIEW === 'true' ? reviewOrigin(process.env) : process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Docked — ' + fantasyTagline, template: '%s | Docked' },
  description: 'Collect limited player cards, build fantasy teams and compete across sports. Closed Preview; football gameplay first.',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Docked' },
  icons: { icon: fantasyAssets.favicon, apple: fantasyAssets.apple },
  openGraph: { title: 'Docked — ' + fantasyTagline, images: [fantasyAssets.social] },
  twitter: { card: 'summary_large_image', title: 'Docked — ' + fantasyTagline, images: [fantasyAssets.social] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: brand.colors.navy };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const environment = await environmentPresentation();
`+body+'}\n');
p='src/core/fantasy-production.ts';s=get(p);const ps=s.indexOf('export function fantasyPresentationEnabled');const pe=s.indexOf('export function fantasyProductionEnabled');s=s.slice(0,ps)+`export function fantasyPresentationEnabled(_env: Record<string, string | undefined> = process.env) {
  // Identity never falls back to a retired product. This grants no gameplay authority.
  return true;
}

`+s.slice(pe);s=s.replace('import { assertHostedBeta } from "./hosted-beta.mjs";\n','');put(p,s);
p='src/brand/brand-tokens.json';s=JSON.parse(get(p));s.tagline='COLLECT. BUILD. COMPETE.';put(p,JSON.stringify(s,null,2)+'\n');
p='src/brand/brand.ts';put(p,`import suppliedTokens from './brand-tokens.json';
import { fantasyAssets } from './fantasy-assets';
/** Fantasy card identity supplied by the owner. */
export const brand = suppliedTokens;
export const brandAssets = { mark: fantasyAssets.icon512, social: fantasyAssets.social } as const;
`);
put('src/app/home/page.tsx',`import { redirect } from 'next/navigation';
export default function Home() { redirect('/fantasy/play'); }
`);
put('src/app/opengraph-image.tsx',`import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const alt = 'Docked — COLLECT. BUILD. COMPETE.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';
export default async function Image() {
  return new Response(new Uint8Array(await readFile(path.join(process.cwd(), 'public/brand/docked/social/docked-open-graph-1200x630.jpg'))), { headers: { 'Content-Type': contentType } });
}
`);
put('src/app/manifest.ts',`import type { MetadataRoute } from 'next';
import { fantasyAssets } from '@/brand/fantasy-assets';
import { brand } from '@/brand/brand';
export default function manifest(): MetadataRoute.Manifest {
 return { id:'/home', name: 'Docked — COLLECT. BUILD. COMPETE.', short_name:'Docked', description:'Fantasy sports cards. Closed Preview.', start_url:'/app', scope:'/', display:'standalone', background_color:brand.colors.navy, theme_color:brand.colors.navy, lang:'en', icons:[
 { src:fantasyAssets.icon192, sizes:'192x192', type:'image/png', purpose:'any' },
 { src:fantasyAssets.icon512, sizes:'512x512', type:'image/png', purpose:'any' },
 { src:fantasyAssets.maskable, sizes:'512x512', type:'image/png', purpose:'maskable' }
 ] };
}
`);
put('src/app/sitemap.ts',`import type { MetadataRoute } from 'next';
/** Protected Preview has no public content inventory. */
export default function sitemap(): MetadataRoute.Sitemap { return []; }
`);
p='package.json';s=JSON.parse(get(p));s.description='Multi-sport fantasy cards with permanent scarcity and secure ownership';delete s.scripts.research;delete s.scripts['research:source-check'];delete s.scripts.worker;put(p,JSON.stringify(s,null,2)+'\n');
