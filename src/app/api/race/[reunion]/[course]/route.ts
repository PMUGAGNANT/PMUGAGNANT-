import { NextResponse } from 'next/server';
import { getParticipants, getRealtimeOdds, getAllRaces, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace, getMinutesUntilStart } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reunion: string; course: string }> }
) {
  const { reunion, course } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayDateStr();
  const rNum = parseInt(reunion);
  const cNum = parseInt(course);

  try {
    // Get race info from programme
    const allRaces = await getAllRaces(date);
    const courseInfo = allRaces.find(r => r.reunion === rNum && r.course === cNum);

    if (!courseInfo) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Get participants
    const participants = await getParticipants(date, rNum, cNum);

    // Check if pronostic should be revealed (30 min before start)
    const minutesUntil = getMinutesUntilStart(courseInfo.heureDepart);
    const isFinished = minutesUntil < -10; // Consider finished 10 min after start
    const pronoAvailable = minutesUntil <= 30;

    let analysis = null;
    if (pronoAvailable && participants.length > 0) {
      analysis = analyzeRace(courseInfo, participants);
    }

    return NextResponse.json({
      success: true,
      courseInfo,
      participants: participants.length,
      minutesUntilStart: minutesUntil,
      pronoAvailable,
      isFinished,
      analysis,
    });
  } catch (error) {
    console.error('Race analysis error:', error);
    return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
  }
}
