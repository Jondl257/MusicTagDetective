import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildURL,resolveOperation} from '../lib/musicbrainz.mjs';
test('direct and rewritten routes identify the operation',()=>{
 for(const op of ['search','recording']){
  assert.equal(resolveOperation('https://app.example/.netlify/functions/musicbrainz?operation='+op),op);
  assert.equal(resolveOperation('https://app.example/api/'+op+'?title=Test'),op);
 }
 const search='https://app.example/.netlify/functions/musicbrainz?title=Test&artist=Artist';
 const recording='https://app.example/.netlify/functions/musicbrainz?id=11111111-1111-1111-1111-111111111111';
 assert.equal(resolveOperation(search),'search');
 assert.equal(resolveOperation(recording),'recording');
 assert.throws(()=>buildURL('',new URL(search).searchParams),/Unbekannte Operation/);
 assert.equal(new URL(buildURL(resolveOperation(search),new URL(search).searchParams)).pathname,'/ws/2/recording/');
 assert.equal(new URL(buildURL(resolveOperation(recording),new URL(recording).searchParams)).pathname,'/ws/2/recording/11111111-1111-1111-1111-111111111111');
 assert.equal(resolveOperation('https://app.example/.netlify/functions/musicbrainz?title=Test&id=11111111-1111-1111-1111-111111111111'),'');
 assert.equal(resolveOperation('https://app.example/api/search?operation=evil'),'evil');
});
test('Netlify function uses route and parameter operation resolution',async()=>{
 const source=await readFile(new URL('../netlify/functions/musicbrainz.mjs',import.meta.url),'utf8');
 assert.match(source,/import\s*\{[^}]*\bresolveOperation\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/lib\/musicbrainz\.mjs['"]/);
 assert.match(source,/operation\s*=\s*resolveOperation\(req\.url\)/);
});
test('actual browser API sends operations, Unicode and test header directly',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const start=html.indexOf('async function api('),end=html.indexOf('\nfunction audioHTML',start);assert.ok(start>0&&end>start);
 const requests=[],sandbox={URLSearchParams,AbortController,setTimeout,clearTimeout,Error,Date,fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({candidates:[]})}}};
 vm.createContext(sandbox);vm.runInContext("let testCode='test-code',recorded=[];"+html.slice(start,end),sandbox);
 await sandbox.api('/api/search',{title:'Dorul călător',artist:'Tudor Gheorghe'});
 await sandbox.api('/api/recording',{id:'11111111-1111-1111-1111-111111111111'});
 const a=new URL(requests[0].url,'https://app.example'),b=new URL(requests[1].url,'https://app.example');
 assert.equal(a.pathname,'/.netlify/functions/musicbrainz');assert.equal(a.searchParams.get('operation'),'search');assert.equal(a.searchParams.get('title'),'Dorul călător');assert.equal(b.searchParams.get('operation'),'recording');assert.equal(requests[0].opts.headers['x-test-code'],'test-code');
});
