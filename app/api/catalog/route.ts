import {NextResponse} from 'next/server';
import {cars} from '@/lib/engine';
export function GET(){return NextResponse.json({cars,source:'Recovered project dataset, June 2026. Specifications and prices are unverified historical examples.'});}
