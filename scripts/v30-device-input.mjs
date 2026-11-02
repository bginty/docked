// Existing authorised device only. Values are read privately, never arguments/logs.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import assert from 'node:assert/strict';
const adb='C:/Users/61412/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const shell=command=>execFileSync(adb,['-s','RFCX30C95JF','shell','sh','-s'],{input:command+'\n',encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});
const mode=process.argv[2];
if(mode==='operator'){
 const e=JSON.parse(fs.readFileSync('C:/Users/61412/.codex/worktrees/v30-transport/Docked.com.au/private-data/v30-transport/env.private.json'));
 assert.match(e.DOCKED_V30_TRANSPORT_KEY,/^[a-f0-9]{64}$/);
 assert.equal(process.argv[3],'focused','Focus the current observed TEST code field first');
 shell('input text '+e.DOCKED_V30_TRANSPORT_KEY);
 shell('input keyevent 4');
 console.log('Operator code entered in observed TEST form; not submitted.');
}else if(mode==='email'||mode==='password'){
 const f=JSON.parse(fs.readFileSync('private-data/restored-public-preview/fixture.private.json'));
 const b=JSON.parse(fs.readFileSync('private-data/restored-public-preview/billing.private.json'));
 const a=f.accounts.find(a=>a.kind==='member');assert.equal(a.email,b.email);
 const value=a[mode];assert.match(value,/^[A-Za-z0-9@.!_+-]+$/);
 assert.equal(process.argv[3],'focused');
 shell(`input text '${value}'`);
 console.log('Existing isolated member credential entered; not submitted.');
}else throw Error('Unsupported input');
