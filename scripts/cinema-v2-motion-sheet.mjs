import { execFileSync } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [input, output, rate = '2', columns = '8'] = process.argv.slice(2);
if (!input || !output) throw Error('Pass input video and output directory.');
await mkdir(output, { recursive: true });
const ffmpeg = path.join(process.env.LOCALAPPDATA, 'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-y','-i',input,'-vf','scale=164:-1','-r',rate,'-frames:v','60',path.join(output,'frame-%03d.png')]);
const files = (await readdir(output)).filter(x => /^frame-\d+\.png$/.test(x)).sort();
const cols = Number(columns), rowHeight = 365;
const pieces = [];
for (const [i, name] of files.entries()) {
  pieces.push({ input: await sharp(path.join(output,name)).resize({width:164,height:339,fit:'contain'}).png().toBuffer(), left:(i%cols)*174,top:Math.floor(i/cols)*rowHeight });
  const text = `<svg width="164" height="24"><text x="8" y="17" fill="#c9d9ed" font-family="Arial" font-size="13">${(i/Number(rate)).toFixed(2)} s</text></svg>`;
  pieces.push({ input:Buffer.from(text),left:(i%cols)*174,top:Math.floor(i/cols)*rowHeight+339 });
}
await sharp({create:{width:cols*174,height:Math.ceil(files.length/cols)*rowHeight,channels:4,background:'#050b15'}}).composite(pieces).png().toFile(path.join(output,'motion-sheet.png'));
console.log(path.join(output,'motion-sheet.png'));
