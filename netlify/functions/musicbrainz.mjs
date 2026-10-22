import {getStore} from '@netlify/blobs';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {ApiError,buildURL,normalize,acquire,release,resolveOperation} from '../../lib/musicbrainz.mjs';
const json=(obj,status=200,retry=0)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(retry?{'Retry-After':String(retry)}:{})}});
export default async function handler(req){
 let lease,store,cooldown=2000;
 try{
  if(req.method!=='GET')return json({error:'Nur GET erlaubt.'},405);
  const code=process.env.TEST_ACCESS_CODE,ua=process.env.MUSICTAG_USER_AGENT;
  if(!code||code.length<16||!ua||ua.length<15)return json({error:'Server noch nicht eingerichtet: TEST_ACCESS_CODE (mindestens 16 Zeichen) und MUSICTAG_USER_AGENT konfigurieren.'},503);
  const given=req.headers.get('x-test-code')||'';
  const hash=s=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(hash(code),hash(given)))return json({error:'Testcode fehlt oder ist falsch. Oben den Netlify-Testcode eingeben.'},401);
  const p=new URL(req.url).searchParams,operation=resolveOperation(req.url),url=buildURL(operation,p);
  const key='cache/'+createHash('sha256').update(url).digest('hex');
  store=getStore({name:'musictag-musicbrainz-v1',consistency:'strong'});
  const cached=await store.get(key,{type:'json'});
  if(cached?.expires>Date.now())return json({...cached.result,cached:true});
  lease=await acquire(store,randomUUID());
  // Recheck after lease: avoid fetching identical concurrent cache misses.
  const second=await store.get(key,{type:'json'});
  if(second?.expires>Date.now())return json({...second.result,cached:true});
  if(Date.now()>lease.expires-15000)throw new ApiError(503,'Start der Anfrage hat zu lange gedauert. Bitte erneut versuchen.');
  const response=await fetch(url,{headers:{'User-Agent':ua,'Accept':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok){
   const retry=response.headers.get('retry-after');cooldown=Math.max(2000,Math.min(300000,(Number(retry)||5)*1000));
   throw new ApiError(response.status===429||response.status===503?503:502,'MusicBrainz antwortet mit HTTP '+response.status+'. Bitte später erneut versuchen.',Math.ceil(cooldown/1000));
  }
  let data;try{data=await response.json()}catch{throw new ApiError(502,'MusicBrainz lieferte keine gültige JSON-Antwort.');}
  const result=operation==='search'?{candidates:(data.recordings||[]).map(normalize).filter(Boolean),query:new URL(url).searchParams.get('query')}:{candidate:normalize(data)};
  if(operation==='recording'&&!result.candidate)throw new ApiError(502,'MusicBrainz lieferte keine gültige Aufnahme.');
  await store.setJSON(key,{result,expires:Date.now()+86400000});
  return json({...result,cached:false});
 }catch(e){return json({error:e instanceof ApiError?e.message:'Datenbank oder gemeinsamer Anfragespeicher nicht erreichbar. Es wurden keine Werte geändert.'},e.status||502,e.retry||0)}
 finally{if(lease&&store)try{await release(store,lease,cooldown)}catch{/* Lease expires safely if write fails. */}}
}
export const config={rateLimit:{windowLimit:30,windowSize:60,aggregateBy:['ip','domain']}};
