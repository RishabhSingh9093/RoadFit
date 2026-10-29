/** Public OSM retrieval. Small-area map exports avoid dependence on Overpass query workers. */
export type Point={lat:number;lon:number};
export type RoadElement={type?:string;id?:number;lat?:number;lon?:number;nodes?:number[];tags?:Record<string,string>;geometry?:Point[]};
export type RoadResponse={elements?:RoadElement[];remark?:string};
export type RoadsResult={elements:RoadElement[];provider:string;fetchedAt:string};
const headers={'User-Agent':'RoadFit/2.1 (+https://roadfit-intelligence.tangygrass25.chatgpt.site)','Accept':'application/json'};
const highway=/^(motorway|trunk|primary|secondary|tertiary|residential|service|living_street|unclassified)(?:_link)?$/;
const cache=new Map<string,{expires:number;value:RoadsResult}>();
const pending=new Map<string,Promise<RoadsResult>>();
const ttl=10*60*1000;

// Retain the longest connected part of a way inside the circle. Boundary-crossing
// segments are kept even if both of their original nodes lie outside the circle.
export function clipToRadius(points:Point[],lat:number,lng:number,radius:number):Point[]{
 const scaleX=111320*Math.cos(lat*Math.PI/180),scaleY=111320;
 if(Math.abs(scaleX)<1)return [];
 const paths:Point[][]=[];let path:Point[]=[];
 for(let i=1;i<points.length;i++){
  const a={x:(points[i-1].lon-lng)*scaleX,y:(points[i-1].lat-lat)*scaleY};
  const b={x:(points[i].lon-lng)*scaleX,y:(points[i].lat-lat)*scaleY};
  const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy,B=2*(a.x*dx+a.y*dy),C=a.x*a.x+a.y*a.y-radius*radius;
  let lo=0,hi=1;
  if(A===0)continue;
  const discriminant=B*B-4*A*C;
  if(discriminant<0){if(C>0){if(path.length)paths.push(path);path=[];continue;}}
  else{const root=Math.sqrt(discriminant);lo=Math.max(0,(-B-root)/(2*A));hi=Math.min(1,(-B+root)/(2*A));if(lo>=hi){if(path.length)paths.push(path);path=[];continue;}}
  const point=(t:number)=>({lat:lat+(a.y+dy*t)/scaleY,lon:lng+(a.x+dx*t)/scaleX});
  const start=point(lo),end=point(hi);
  if(path.length){const last=path[path.length-1];if(Math.abs(last.lat-start.lat)>1e-8||Math.abs(last.lon-start.lon)>1e-8){paths.push(path);path=[];}}
  if(!path.length)path.push(start);path.push(end);
  if(hi<1){paths.push(path);path=[];}
 }
 if(path.length)paths.push(path);
 const length=(p:Point[])=>p.slice(1).reduce((sum,x,i)=>sum+Math.hypot((x.lon-p[i].lon)*scaleX,(x.lat-p[i].lat)*scaleY),0);
 return paths.sort((a,b)=>length(b)-length(a))[0]||[];
}
export function normalizeRoads(data:RoadResponse,lat:number,lng:number,radius:number):RoadElement[]{
 if(!Array.isArray(data.elements)||data.remark)throw Error('Incomplete road-data response');
 const nodes=new Map<number,Point>();
 for(const e of data.elements)if(e.type==='node'&&typeof e.id==='number'&&Number.isFinite(e.lat)&&Number.isFinite(e.lon))nodes.set(e.id,{lat:e.lat!,lon:e.lon!});
 return data.elements.filter(e=>e.type==='way'&&highway.test(e.tags?.highway||'')&&e.tags?.access!=='no'&&e.tags?.motor_vehicle!=='no').map(e=>{
  const points=e.geometry||(e.nodes||[]).map(id=>nodes.get(id)).filter((p):p is Point=>!!p);
  return {type:'way',id:e.id,tags:e.tags,geometry:clipToRadius(points,lat,lng,radius)};
 }).filter(e=>e.geometry.length>=2).slice(0,2500);
}
async function readJSON(response:Response):Promise<RoadResponse>{
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 // Bounded reads keep dense map exports within the hosted Worker's memory budget.
 const reader=response.body?.getReader();if(!reader)throw Error('Empty provider response');
 const decoder=new TextDecoder();let text='',bytes=0;
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>12_000_000){await reader.cancel();throw Error('Area too dense; use a 500 metre radius');}text+=decoder.decode(value,{stream:true});}
 text+=decoder.decode();return JSON.parse(text) as RoadResponse;
}
async function fromMap(lat:number,lng:number,radius:number):Promise<RoadsResult>{
 const dy=radius/111320,dx=dy/Math.max(.01,Math.cos(lat*Math.PI/180));
 const west=Math.max(-180,lng-dx),south=Math.max(-90,lat-dy),east=Math.min(180,lng+dx),north=Math.min(90,lat+dy);
 if((east-west)*(north-south)>.20)throw Error('Map area exceeds provider limit');
 const bbox=[west,south,east,north].map(x=>x.toFixed(7)).join(',');
 const res=await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`,{headers,signal:AbortSignal.timeout(20000)});
 const elements=normalizeRoads(await readJSON(res),lat,lng,radius);
 return {elements,provider:'OpenStreetMap map API',fetchedAt:new Date().toISOString()};
}
async function fromOverpass(lat:number,lng:number,radius:number,endpoint:string):Promise<RoadsResult>{
 const query=`[out:json][timeout:15];way(around:${radius},${lat},${lng})["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|living_street|unclassified)(_link)?$"];out tags geom;`;
 const res=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers,signal:AbortSignal.timeout(20000)});
 const elements=normalizeRoads(await readJSON(res),lat,lng,radius);
 return {elements,provider:new URL(endpoint).hostname,fetchedAt:new Date().toISOString()};
}
async function retrieve(lat:number,lng:number,radius:number):Promise<RoadsResult>{
 const map=()=>fromMap(lat,lng,radius);
 const primary=()=>fromOverpass(lat,lng,radius,'https://overpass-api.de/api/interpreter');
 const alternate=()=>fromOverpass(lat,lng,radius,'https://overpass.private.coffee/api/interpreter');
 const attempts=radius===500?[map,primary,alternate]:[primary,map,alternate];
 const failures:string[]=[];
 for(const attempt of attempts){try{return await attempt();}catch(e){failures.push(e instanceof Error?e.message:'Connection failed');}}
 console.warn('RoadFit road providers failed:',failures.join('; '));
 throw Error(failures.some(f=>f.includes('too dense'))?'This area contains too much map data. Choose a 500 metre radius.':'Could not reach the road-data providers. Check your internet connection and try again. No live data was replaced with demo data.');
}
export async function fetchRoads(lat:number,lng:number,radius:number):Promise<RoadsResult>{
 const key=`${lat.toFixed(5)},${lng.toFixed(5)},${radius}`;
 const existing=cache.get(key);if(existing&&existing.expires>Date.now())return existing.value;
 const underway=pending.get(key);if(underway)return underway;
 const request=retrieve(lat,lng,radius).then(value=>{
  if(cache.size>=30)cache.delete(cache.keys().next().value!);
  cache.set(key,{value,expires:Date.now()+ttl});return value;
 }).finally(()=>pending.delete(key));
 pending.set(key,request);return request;
}
