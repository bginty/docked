import postgres from 'npm:postgres@3.4.9';
import {timingSafeEqual,createHash} from 'node:crypto';
import {runNflCollection} from './worker.mjs';
import {ca} from './ca.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest();
Deno.serve(async(req:Request)=>{
 const expected=Deno.env.get('DOCKED_NFL_WORKER_TOKEN');
 if(req.method!=='POST'||!expected||!timingSafeEqual(hash(req.headers.get('x-docked-worker')??''),hash(expected)))return new Response('Denied',{status:403});
 const task=new URL(req.url).searchParams.get('task');
 if(!['weekly','pbp','rosters','reconcile'].includes(task??''))return new Response('Invalid task',{status:400});
 const url=new URL(Deno.env.get('DOCKED_NFL_WORKER_DATABASE_URL')??'https://invalid');
 if(url.username!=='docked_nfl_worker.pojoymtniryarxxunyvz'||!/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(url.hostname))return new Response('Unconfigured',{status:503});
 const sql=postgres(url.href,{ssl:{rejectUnauthorized:true,ca},max:2,prepare:false,connect_timeout:15,onnotice:()=>{}});
 try {const result=await runNflCollection(sql,task,2026);return Response.json(result);}
 catch{return Response.json({status:'failed',task,season:2026,message:'Collection pending; inspect private health'},{status:503});}
 finally{await sql.end({timeout:3});}
});
