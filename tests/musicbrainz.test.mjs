import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildURL,normalize,acquire,release} from '../lib/musicbrainz.mjs';
class Store{
 constructor(){this.values=new Map();this.version=0}
 async getWithMetadata(k){return this.values.get(k)||null}
 async setJSON(k,data,options={}){const old=this.values.get(k);if(options.onlyIfNew&&old||options.onlyIfMatch&&options.onlyIfMatch!==old?.etag)return {modified:false};const etag=String(++this.version);this.values.set(k,{data,etag});return {modified:true,etag}}
}
const id='11111111-1111-1111-1111-111111111111';
test('search includes Romanian Unicode and escapes query operators',()=>{const u=new URL(buildURL('search',new URLSearchParams({title:'Dorul călător "live"',artist:'Tudor Gheorghe'})));assert.match(u.searchParams.get('query'),/călător/);assert.ok(u.searchParams.get('query').includes('\\"live\\"'));assert.throws(()=>buildURL('search',new URLSearchParams()),/Titel fehlt/)});
test('reject arbitrary recording paths',()=>assert.throws(()=>buildURL('recording',new URLSearchParams({id:'../artist'}))));
test('recording year and edition year remain separate',()=>{const c=normalize({id,'first-release-date':'1971',releases:[{id,date:'2009-10-01',title:'Compilation'}]});assert.equal(c.firstReleaseYear,'1971');assert.equal(c.releases[0].year,'2009')});
test('unknown dates remain null',()=>{const c=normalize({id,releases:[{id}]});assert.equal(c.firstReleaseYear,null);assert.equal(c.releases[0].year,null)});
test('atomic lease permits only one concurrent client',async()=>{const store=new Store();const r=await Promise.allSettled([acquire(store,'a',1000),acquire(store,'b',1000)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected').length,1)});
test('cooldown prevents immediate follow-up',async()=>{const store=new Store(),lease=await acquire(store,'a');await release(store,lease);await assert.rejects(()=>acquire(store,'b'),e=>e.status===429)});
test('stale lease cannot release a new owner',async()=>{const store=new Store(),first=await acquire(store,'a',1000),second=await acquire(store,'b',40000);await release(store,first);assert.equal((await store.getWithMetadata(second.key)).data.token,'b')});
