import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
mkdirSync('work',{recursive:true});
const temp=mkdtempSync(path.resolve('work/auth-test-'));
const databaseUrl=`file:${path.join(temp,'test.db').replaceAll('\\','/')}`;
const {writeFileSync}=await import('node:fs');writeFileSync(path.join(temp,'test.db'),'');
const env={...process.env,DATABASE_URL:databaseUrl,APP_ORIGIN:'http://127.0.0.1:3101'};
const schema=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,encoding:'utf8'});
if(schema.status!==0)throw Error(schema.stdout+schema.stderr);
const db=new PrismaClient({datasourceUrl:databaseUrl});
const base='http://127.0.0.1:3101';
let log='';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',d=>{log+=d});server.stderr.on('data',d=>{log+=d});
async function call(route,method='GET',data,cookie,origin=base){return fetch(base+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});}
try{
 let ready=false;for(let i=0;i<60;i++){try{const r=await call('/api/applications');if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
 assert.ok(ready,log);
 const legacy=await db.application.create({data:{company:'Legacy',position:'Developer',appliedAt:'2026-10-18'}});
 const credentials={name:'Test User',email:'first@example.test',password:'Test-only-password-123'};
 let r=await call('/api/auth/register','POST',credentials);assert.equal(r.status,201,await r.text());
 const first=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/i);assert.match(r.headers.get('set-cookie'),/SameSite=lax/i);
 r=await call('/api/applications','GET',null,first);assert.ok((await r.json()).some(a=>a.id===legacy.id),'First account receives legacy records');
 r=await call('/api/auth/register','POST',{...credentials,email:'second@example.test'});assert.equal(r.status,201);const second=r.headers.get('set-cookie').split(';')[0];
 r=await call('/api/applications','GET',null,second);assert.deepEqual(await r.json(),[]);
 const data={company:'Acme',position:'Engineer',url:'https://example.com/jobs/1',status:'APPLIED',appliedAt:'2026-10-18',notes:'Private'};
 r=await call('/api/applications','POST',data,first);assert.equal(r.status,201);const item=await r.json();
 for(const method of ['PUT','DELETE']){r=await call('/api/applications',method,{...data,id:item.id},second);assert.equal(r.status,404);}
 r=await call('/api/applications','PUT',{...data,id:item.id,status:'INTERVIEW'},first);assert.equal(r.status,200);assert.equal((await r.json()).status,'INTERVIEW');
 r=await call('/api/applications','POST',data,first,'https://foreign.example');assert.equal(r.status,403);
 r=await call('/api/auth/login','POST',{...credentials,password:'Wrong-password'});assert.equal(r.status,401);
 r=await call('/api/auth/logout','POST',{},first);assert.equal(r.status,200);
 r=await call('/api/applications','GET',null,first);assert.equal(r.status,401);
 r=await call('/api/auth/login','POST',credentials);assert.equal(r.status,200);const again=r.headers.get('set-cookie').split(';')[0];
 r=await call('/api/applications','GET',null,again);assert.equal(r.status,200);assert.equal((await r.json()).length,2);
 await db.session.updateMany({data:{expiresAt:new Date(0)}});
 r=await call('/api/applications','GET',null,again);assert.equal(r.status,401);
 for(let i=0;i<11;i++)r=await call('/api/auth/login','POST',{email:'nobody@example.test',password:'Wrong-password'});
 assert.equal(r.status,429);
 console.log('PASS: registration, legacy migration, login, isolation, CRUD, CSRF, logout, expiry, rate limit.');
}finally{
 server.kill();await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve)});
 await db.$disconnect();try{rmSync(temp,{recursive:true,force:true});}catch{}
}
