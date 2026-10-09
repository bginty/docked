import {readFileSync,writeFileSync} from 'node:fs';
const get=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n');const put=(p,s)=>writeFileSync(p,s);const edit=(p,f)=>put(p,f(get(p)));
const pricing=get('src/core/pricing.ts');put('src/core/canonical-hash.ts',"import {createHash} from 'node:crypto';\n"+pricing.slice(pricing.indexOf('export function canonical'),pricing.indexOf('export const configHash')).replace('// Runtime/version is retained with each research code commit.','// Preserve the existing digest format for account tokens and audit identities.'));
for(const p of ['src/app/auth/recovery/route.ts','src/app/auth/invite/route.ts','src/app/api/auth/route.ts','src/app/api/unsubscribe/route.ts'])edit(p,s=>s.replace('@/core/pricing','@/core/canonical-hash'));
edit('src/components/community-feed.tsx',s=>s.replace('import { BetaReading } from "./beta-reading";\n','').replace('              <Link href="/top-docked">Top Docked</Link>','              <Link href="/fantasy/play">Fantasy competitions</Link>').replace('      {compact && feed.posts.length === 0 && <BetaReading />}',''));
edit('src/components/community-admin.tsx',s=>s.replace('verify odds or settle a record.','change card ownership or competition scores.'));
edit('src/components/forms.tsx',s=>s.replace('["sports", "leagues", "bookmakers"]','["sports", "leagues"]'));
edit('src/core/preview-testers.ts',s=>s.replace('  "preview_market_fixtures",\n','').replace('  "preview_top_docked",\n',''));
edit('scripts/build-app-icons.mjs',s=>s.replace('approved Edge Signal raster assets','supplied fantasy card raster assets'));
edit('src/app/robots.ts',()=>`import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',disallow:'/'}};}
`);
edit('tests/platform/research-navigation.test.ts',s=>s.replace('permit only UUID content within the approved origin','are retired even within the approved origin').replace('), route);','), null);').replace('origin), route);','origin), null);'));
edit('tests/platform/native-navigation.test.ts',s=>{
s=s.replace('["/edges", "/feed", "/following", "/points", "/my-edge"]','["/fantasy/play", "/fantasy/cards", "/fantasy/market", "/fantasy/social", "/fantasy/profile"]');
s=s.replace(/(nativeDeepLink\(`docked:\/\/community\/edges\/\$\{id\}`\),\n\s*)`\/community\/edges\/\$\{id\}`/,'$1null');
s=s.replace(/(nativeDeepLink\(`docked:\/\/(?:tips|edges|results)\/\$\{id\}`\),\n\s*)`\/tips\/\$\{id\}`/g,'$1null');
s=s.replace(/(nativeDeepLink\(`https:\/\/preview.example.test\/results\/\$\{id\}`,\s*"https:\/\/preview.example.test"\),\s*)`\/tips\/\$\{id\}`/g,'$1null');
return s;
});
edit('src/brand/brand-tokens.json',s=>{const v=JSON.parse(s);Object.assign(v.colors,{navy:'#0B0F1A',blue:'#1A2AFF',coolGray:'#9CA3AF',cyan:'#00D1FF',purple:'#8B3DFF'});return JSON.stringify(v,null,2)+'\n';});
