import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'RoadFit — Find your road fit',description:'Know your roads. Find your car. AI road intelligence and transparent car matching.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
