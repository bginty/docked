import postgres from 'npm:postgres@3.4.9';
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createHash} from 'node:crypto';
import {ca} from '../nfl-postgame/ca.ts';
import {customerSignup} from './handler.mjs';
const project='https://pojoymtniryarxxunyvz.supabase.co';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
Deno.serve(async(req:Request)=>{
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST'||Deno.env.get('DOCKED_CUSTOMER_SIGNUP_ENABLED')!=='true'||Deno.env.get('SUPABASE_URL')!==project) return Response.json({error:'Invite required'}, {status:403,headers});
 const declared=Number(req.headers.get('content-length'));
 const origin=Deno.env.get('DOCKED_CUSTOMER_ORIGIN');
 if(origin!=='https://docked.com.au'&&!/^https:\/\/docked-production-[a-z0-9-]+\.vercel\.app$/.test(origin??''))return new Response('Unavailable',{status:503,headers});
 if(declared>4096) return new Response('Request too large',{status:413,headers});
 const reader=req.body?.getReader(); let bytes=new Uint8Array();
 if(!reader)return new Response('Invalid request',{status:400,headers});
 while(true){const {done,value}=await reader.read();if(done)break;if(bytes.length+value.length>4096){await reader.cancel();return new Response('Request too large',{status:413,headers});}const next=new Uint8Array(bytes.length+value.length);next.set(bytes);next.set(value,bytes.length);bytes=next;}
 const url=new URL(Deno.env.get('DOCKED_SIGNUP_DATABASE_URL')??'https://invalid');
 if(url.username!=='docked_signup_worker.pojoymtniryarxxunyvz'||!/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(url.hostname))return new Response('Unavailable',{status:503,headers});
 const sql=postgres(url.href,{ssl:{rejectUnauthorized:true,ca},max:1,prepare:false,connect_timeout:15,onnotice:()=>{}});
 const admin=createClient(project,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const client=createClient(project,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const result=await customerSignup(JSON.parse(new TextDecoder().decode(bytes)),{
   reserve:async(email:string,token:string)=>(await sql`select beta_private.begin_customer_signup(${email},${hash(token)}) id`)[0].id,
   lookup:async(id:string)=>{const r=await admin.auth.admin.getUserById(id);if(r.error&&r.error.code!=='user_not_found')throw Error('Auth unavailable');return r.data.user;},
   create:async(id:string,email:string,password:string)=>{const r=await admin.auth.admin.createUser({id,email,password,email_confirm:false});if(r.error)throw Error('Creation unavailable');return r.data.user;},
   bind:async(id:string,token:string)=>{await sql`select beta_private.finish_customer_signup(${id},${hash(token)})`;},
   verify:async(email:string)=>{const r=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:origin+'/auth/callback?next=/app/verified'}});if(r.error)throw Error('Verification unavailable');},
  });
  return Response.json(result,{headers});
 }catch{return Response.json({error:'Check your invitation and email, or sign in if you already created your account. If verification is delayed, retry in a minute.'},{status:409,headers});}
 finally{await sql.end({timeout:3});}
});
