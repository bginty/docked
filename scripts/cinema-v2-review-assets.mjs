import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const output=process.env.DOCKED_VISUAL_EVIDENCE;
if(!output) throw Error('Set DOCKED_VISUAL_EVIDENCE.');
const reference='C:/Users/61412/Documents/ChatGPT/Docked.com.au/.codex-attachments/1b792ebd-b9c2-4e82-8c10-4cea453774f0/a67b62ac-344c-4518-9585-d9ddf97466df/1000051759.png';
const crops=[{left:232,top:83,width:209,height:229},{left:438,top:83,width:219,height:229},{left:657,top:79,width:246,height:233}];
const label=(text,width,height=40,size=18)=>Buffer.from(`<svg width="${width}" height="${height}"><text x="12" y="28" fill="#dceafa" font-family="Arial" font-size="${size}">${text}</text></svg>`);
for(const tier of ['legendary','icon']) {
  const columns=tier==='legendary'?3:2;
  const width=columns*326+24; const pieces=[];
  pieces.push({input:label(`DOCKED / ${tier.toUpperCase()} / MATCHED STAGES`,width,52,23),left:0,top:5});
  const headers=tier==='legendary'?['APPROVED REFERENCE','V1 · afa144cd','V2 · PROTOTYPE']:['V1 · afa144cd','V2 · PROTOTYPE'];
  for(let c=0;c<columns;c++)pieces.push({input:label(headers[c],316,40,16),left:12+c*326,top:57});
  for(const [row,stage] of ['rarity','flip','player'].entries()) {
    const y=105+row*520;
    pieces.push({input:label(stage==='rarity'?'RARITY ANNOUNCEMENT':stage==='flip'?'FLIP · matched 72-degree turn':'PLAYER · existing Docked artwork',width,40,15),left:0,top:y});
    for(let c=0;c<columns;c++) {
      let buffer;
      if(tier==='legendary'&&c===0)buffer=await sharp(reference).extract(crops[row]).resize({width:310,height:465,fit:'contain',background:'#050b14'}).png().toBuffer();
      else {
        const version=c===columns-1?'v2':'v1';
        buffer=await sharp(path.join(output,`${version}-${tier}-${stage}.png`)).extract({left:1,top:178,width:410,height:600}).resize({width:310,height:465,fit:'contain',background:'#050b14'}).png().toBuffer();
      }
      pieces.push({input:buffer,left:15+c*326,top:y+40});
    }
  }
  await sharp({create:{width,height:1685,channels:4,background:'#07101e'}}).composite(pieces).png().toFile(path.join(output,`${tier}-comparison.png`));
}
const performance=JSON.parse(await readFile(path.join(output,'performance.json'),'utf8'));
await writeFile(path.join(output,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked / Cinematic V2 review</title><style>body{margin:0;background:#030812;color:#eff6ff;font:16px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:30px 20px}h1{font-size:clamp(30px,5vw,62px);line-height:1.1}h2{margin-top:40px}.eyebrow{color:#61caff;letter-spacing:.17em;font-size:12px}p{max-width:820px;color:#b8c8df}a{color:#88d7ff}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:25px}video{width:100%;max-height:730px;border:1px solid #456083;border-radius:18px;background:#000}img{max-width:100%;height:auto}pre{overflow:auto;background:#0c1524;padding:20px;font-size:12px}section{margin-top:35px}small{color:#9eb1ca}</style><main><p class="eyebrow">DOCKED / CINEMATIC V2 / OWNER REVIEW</p><h1>Legendary.<br>Then extraordinary.</h1><p>A working Legendary and Icon prototype using the existing Docked card artwork. Original vector emblems, layered Canvas light and particles, projected rings and a dimensional card turn. No production deployment or financial changes.</p><p><a href="http://127.0.0.1:3137/preview/pack-opening">Open the interactive preview →</a></p><div class="videos"><section><h2>Legendary / AFL</h2><video controls playsinline preload="metadata" poster="v2-legendary-rarity.png" src="legendary-afl-full.webm"></video></section><section><h2>Icon / AFL</h2><video controls playsinline preload="metadata" poster="v2-icon-rarity.png" src="icon-afl-full.webm"></video></section></div><p>These are uninterrupted screen recordings, trimmed only to remove page loading. The videos are silent; enable Sound in the interactive preview to hear the original layered audio. The deterministic sample players use Docked's existing jersey/card renderer. No cards are issued.</p><h2>Reference / V1 / V2</h2><p>Announcement, midpoint and player stages. Flip stills hold the actual CSS animation near a matched 72-degree turn; the videos above play normally. Source aspect ratios are preserved. The concept's human illustration is not substituted for Docked's existing jersey artwork.</p><img alt="Legendary: reference, existing V1 and V2 at matching stages" src="legendary-comparison.png"><h2>Icon / V1 to V2</h2><img alt="Icon V1 and V2 at announcement, flip and player stages" src="icon-comparison.png"><h2>Performance and scope</h2><p>Desktop measurements below are not Samsung performance. The connected-device check found no physical phone. The Android 16 read-only emulator reached the page but Chrome and System UI became unresponsive before reveal acceptance; Android playback remains pending. The other four rarities retain V1 until visual approval.</p><pre>${JSON.stringify(performance,null,2).replace(/</g,'&lt;')}</pre><p>Review the light intensity, orbit movement, emblem prominence and flip impact. Lower rarities and production rollout await owner approval.</p></main></html>`);
console.log(path.join(output,'review.html'));
