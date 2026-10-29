import Dashboard from './dashboard';
import {demoProfile,rank,cars} from '@/lib/engine';
import {getChatGPTUser} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const p=demoProfile();const user=await getChatGPTUser();return <Dashboard initial={{profile:p,matches:rank(p,12,5,'any'),preferences:{budget:12,seats:5,fuel:'any'},location:{lat:12.975,lng:77.637,radius:500,name:'Indiranagar, Bengaluru'},analysedAt:new Date().toISOString()}} catalog={cars} signedIn={!!user}/>;}
