import { NextResponse } from 'next/server';
import { getParticipants, getAllRaces, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace } from '@/lib/analysis';
import { getActiveModelWeightProfile } from '@/lib/learning';

export const dynamic = 'force-dynamic';

function getParisNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
}

function parseDateStr(dateStr: string): Date {
  const day = Number(dateStr.slice(0, 2));
  const month = Number(dateStr.slice(2, 4)) - 1;
  const year = Number(dateStr.slice(4, 8));
  return new Date(year, month, day);
}

function getMinutesUntilStartForDate(dateStr: string, heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const target = parseDateStr(dateStr);
  target.setHours(hours, minutes, 0, 0);
  return (target.getTime() - parisNow.getTime()) / 60000;
}

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
    const minutesUntil = getMinutesUntilStartForDate(date, courseInfo.heureDepart);
    const isFinished = minutesUntil < -10; // Consider finished 10 min after start
    const pronoAvailable = minutesUntil <= 30;

    let analysis = null;
    if (pronoAvailable && participants.length > 0) {
      const weightProfile = await getActiveModelWeightProfile(
        courseInfo.estPlat ? 'PLAT' : 'TROT'
      );
      analysis = analyzeRace(courseInfo, participants, weightProfile);
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
