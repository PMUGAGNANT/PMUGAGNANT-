import { NextResponse } from 'next/server';
import { getAllRaces, getTodayDateStr } from '@/lib/pmu-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayDateStr();

  try {
    const races = await getAllRaces(date);
    return NextResponse.json({ success: true, date, races });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch races' }, { status: 500 });
  }
}
