import { NextResponse } from 'next/server';
import {z} from 'zod';
const input=z.object({mode:z.enum(['live','demo']),budget:z.number().finite().min(1).max(200),seats:z.number().int().min(2).max(9),radius:z.union([z.literal(500),z.literal(1000),z.literal(1500)]),lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180),fuel:z.enum(['any','petrol','diesel','electric','cng','hybrid']),name:z.string().max(100).optional()});
import { demoProfile,liveProfile,rank } from '@/lib/engine';
export async function POST(req:Request){
 try{
 const parsed=input.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Please check your location and car preferences."},{status:400});const b=parsed.data;const budget=Number(b.budget),seats=Number(b.seats),radius=Number(b.radius),lat=Number(b.lat),lng=Number(b.lng);
 if(!Number.isFinite(budget)||budget<1||budget>200||!Number.isInteger(seats)||seats<2||seats>9||!['any','petrol','diesel','electric','cng','hybrid'].includes(b.fuel))return NextResponse.json({error:'Please enter valid car preferences.'},{status:400});
 if(!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lng)||lng< -180||lng>180||![500,1000,1500].includes(radius))return NextResponse.json({error:'Enter valid coordinates and a supported radius.'},{status:400});
 const p=b.mode==='demo'?demoProfile():await liveProfile(lat,lng,radius);
 return NextResponse.json({profile:p,matches:rank(p,budget,seats,b.fuel),preferences:{budget,seats,fuel:b.fuel},location:{lat,lng,radius,name:String(b.name||'Custom location').slice(0,100)},analysedAt:new Date().toISOString()});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Analysis failed. Please try again.'},{status:502});}
}
