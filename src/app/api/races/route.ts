import { NextResponse } from 'next/server';
import { getAllRaces, getTodayDateStr } from '@/lib/pmu-api';
import { badRequest, serverError } from '@/lib/api-response';
import { normalizeRequestedDate } from '@/lib/request-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get('date'), getTodayDateStr());
  if (!date) {
    return badRequest('Invalid date format. Expected DDMMYYYY.');
  }

  try {
    const races = await getAllRaces(date);
    return NextResponse.json({ success: true, date, races });
  } catch (error) {
    return serverError('Failed to fetch races', error, { date });
  }
}
