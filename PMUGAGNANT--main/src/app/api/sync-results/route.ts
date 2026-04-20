import { NextResponse } from "next/server";
import { getArriveeCourse, getRapportsCourse } from "@/lib/pmu-api";
import { saveRunnerOutcome } from "@/lib/prediction-store";
import { isValidPmuDate } from "@/lib/request-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const reunion = Number(searchParams.get("reunion"));
  const course = Number(searchParams.get("course"));

  if (!isValidPmuDate(date) || !Number.isInteger(reunion) || !Number.isInteger(course)) {
    return NextResponse.json(
      { ok: false, error: "Parametres invalides: date, reunion et course requis." },
      { status: 400 }
    );
  }

  const arrivee = await getArriveeCourse(date, reunion, course);
  if (!arrivee || arrivee.length === 0) {
    return NextResponse.json({ ok: true, synced: false, reason: "arrivee_indisponible" });
  }

  const rapports = await getRapportsCourse(date, reunion, course);
  const saved = await saveRunnerOutcome(date, reunion, course, arrivee, rapports);

  return NextResponse.json({
    ok: true,
    synced: true,
    arrivee,
    rapportsAvailable: rapports !== null,
    saved: saved.saved,
  });
}
