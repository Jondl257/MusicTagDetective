export const MBID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class ApiError extends Error {constructor(status,message,retry=0){super(message);this.status=status;this.retry=retry}}
export const phrase=s=>'"'+s.trim().replace(/[+\-!(){}\[\]^"~*?:\\/|&]/g,'\\$&')+'"';
export function buildURL(operation,p){
 const val=k=>{const v=(p.get(k)||'').trim();if(v.length>250)throw new ApiError(400,'Suchangabe zu lang.');return v};
 let path,params;
 if(operation==='search'){
  const title=val('title'),artist=val('artist'),album=val('album');if(!title)throw new ApiError(400,'Titel fehlt.');
  const q=['recording:'+phrase(title),...(artist?['artist:'+phrase(artist)]:[]),...(album?['release:'+phrase(album)]:[])].join(' AND ');
  path='recording/';params={query:q,limit:'8'};
 }else if(operation==='recording'){
  const id=val('id');if(!MBID.test(id))throw new ApiError(400,'Ungültige Aufnahme-ID.');path='recording/'+id;params={inc:'artists+releases'};
 }else throw new ApiError(400,'Unbekannte Operation.');
 return 'https://musicbrainz.org/ws/2/'+path+'?'+new URLSearchParams({...params,fmt:'json'});
}
export function normalize(r){
 if(!r||!MBID.test(r.id||''))return null;
 const date=r['first-release-date']||null;
 return {recordingId:r.id,title:r.title||'',artist:(r['artist-credit']||[]).map(x=>(x.name||x.artist?.name||'')+(x.joinphrase||'')).join(''),durationMs:r.length??null,disambiguation:r.disambiguation||'',firstReleaseDate:date,firstReleaseYear:date?.slice(0,4)||null,searchScore:r.score??null,source:'MusicBrainz',sourceUrl:'https://musicbrainz.org/recording/'+r.id,reviewRequired:true,releases:(r.releases||[]).filter(x=>MBID.test(x.id||'')).map(x=>({id:x.id,album:x.title||'',date:x.date||null,year:x.date?.slice(0,4)||null,country:x.country||null,status:x.status||null,sourceUrl:'https://musicbrainz.org/release/'+x.id}))};
}
// A site-wide CAS lease, shared by every function instance and deployment.
export async function acquire(store,token,now=Date.now()){
 const key='upstream-lease',old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
 if(old&&old.data.until>now)throw new ApiError(429,'Die gemeinsame MusicBrainz-Warteschlange ist belegt. Bitte kurz warten.',Math.max(2,Math.ceil((old.data.until-now)/1000)));
 const result=await store.setJSON(key,{token,until:now+35000},{...(old?{onlyIfMatch:old.etag}:{onlyIfNew:true})});
 if(!result.modified)throw new ApiError(429,'Eine andere Anfrage ist gerade gestartet. Bitte erneut versuchen.',2);
 return {etag:result.etag,key,token,expires:now+35000};
}
export async function release(store,lease,cooldown=2000){
 // A failed/stale release never overwrites a newer owner's lease.
 await store.setJSON(lease.key,{token:lease.token,until:Date.now()+cooldown},{onlyIfMatch:lease.etag});
}

export function resolveOperation(input){
 const url=new URL(input),params=url.searchParams,operation=params.get('operation');
 if(operation!==null)return operation;
 const routeOperation={'/api/search':'search','/api/recording':'recording'}[url.pathname];
 if(routeOperation)return routeOperation;
 if(params.has('title')&&!params.has('id'))return 'search';
 if(params.has('id')&&!params.has('title'))return 'recording';
 return '';
}
