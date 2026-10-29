import catalog from './cars.json';
import {fetchRoads} from './roads';
export const cars = catalog;
export type Car = typeof catalog[number];
export type Road = {width:number;estimated:boolean;type:string;geometry?:{lat:number;lon:number}[]};
export type Profile = {groups:{label:string;center:number;count:number;percent:number}[];average:number;minimum:number;total:number;estimated:number;roads:Road[];source:'live'|'demo';provider?:string;fetchedAt?:string};
const defaults:Record<string,number>={residential:3.5,service:3,secondary:6,motorway:12,trunk:9,primary:7,tertiary:4.5,living_street:2.5,track:2.5,unclassified:3.5};
export function parseWidth(v:unknown):number|null{
 if(typeof v!=='string')return null;
 const m=v.trim().match(/^(\d+(?:\.\d+)?)\s*(m|meters?|metres?|ft|feet|')?$/i);
 if(!m)return null;const n=Number(m[1])*(/^(ft|feet|')$/i.test(m[2]||'')?.3048:1);
 return n>=1&&n<=40?n:null;
}
export function profile(roads:Road[],source:'live'|'demo'):Profile{
 if(!roads.length)throw Error('No drivable roads found here. Try another location or a larger radius.');
 const widths=roads.map(r=>r.width);const unique=[...new Set(widths)].sort((a,b)=>a-b);const k=Math.min(3,unique.length);
 let centers=Array.from({length:k},(_,i)=>unique[Math.round(i*(unique.length-1)/Math.max(1,k-1))]);
 let labels:number[]=[];
 for(let step=0;step<30;step++){
  labels=widths.map(w=>centers.reduce((best,c,i)=>Math.abs(c-w)<Math.abs(centers[best]-w)?i:best,0));
  const next=centers.map((c,i)=>{const a=widths.filter((_,j)=>labels[j]===i);return a.length?a.reduce((s,w)=>s+w,0)/a.length:c;});
  if(next.every((c,i)=>Math.abs(c-centers[i])<.001)){centers=next;break;}centers=next;
 }
 const names=k===1?['Uniform']:k===2?['Narrower','Wider']:['Narrow','Medium','Wide'];
 const groups=centers.map((center,i)=>({label:'',center:+center.toFixed(2),count:labels.filter(x=>x===i).length,percent:0})).sort((a,b)=>a.center-b.center).map((g,i)=>({...g,label:names[i],percent:Math.round(g.count/roads.length*100)}));
 return {groups,average:+(widths.reduce((a,b)=>a+b,0)/widths.length).toFixed(2),minimum:Math.min(...widths),total:roads.length,estimated:roads.filter(x=>x.estimated).length,roads,source};
}
export function demoProfile():Profile{
 const roads=Array.from({length:72},(_,i)=>({width:i<34?2.8+(i%4)*.25:i<60?4.5+(i%3)*.5:7+(i%3),estimated:i%5!==0,type:i<34?'residential':'secondary',geometry:[{lat:12.971+(i%9)*.0008,lon:77.633+Math.floor(i/9)*.0009},{lat:12.971+(i%9)*.0008+.001,lon:77.633+Math.floor(i/9)*.0009+.0008}]}));
 return profile(roads,'demo');
}
export async function liveProfile(lat:number,lng:number,radius:number):Promise<Profile>{
 const data=await fetchRoads(lat,lng,radius);
 const roads=data.elements.map(e=>{const w=parseWidth(e.tags?.width);const type=e.tags?.highway||'unclassified';return {width:w??defaults[type.replace(/_link$/, '')]??3.5,estimated:w===null,type,geometry:e.geometry};});
 return {...profile(roads,'live'),provider:data.provider,fetchedAt:data.fetchedAt};
}
export function rank(p:Profile,budget:number,seats:number,fuel:string){
 return cars.filter(c=>c.price_lakh<=budget&&c.seats>=seats&&(fuel==='any'||c.fuel===fuel)).map(c=>{
 const narrow=p.groups[0].percent/100;
 const compact=Math.max(0,Math.min(100,(2.1-c.width_m)/.65*100));
 const turning=Math.max(0,Math.min(100,(6.2-c.turning_radius_m)/1.8*100));
 const efficiency=Math.max(0,Math.min(100,c.city_kmpl/28*100));
 const score=Math.round(compact*(.35+narrow*.25)+turning*.2+efficiency*(.3-narrow*.25)+c.resale_score*1.5);
 return {...c,score:Math.max(1,Math.min(99,score)),reason:`${c.width_m.toFixed(2)} m body width and ${c.turning_radius_m} m turning radius ${compact>60?'favor compact maneuvering':'trade compactness for cabin size'}. ${p.groups[0].percent}% of sampled roads fall in the ${p.groups[0].label.toLowerCase()} cluster.`};
 }).sort((a,b)=>b.score-a.score);
}
