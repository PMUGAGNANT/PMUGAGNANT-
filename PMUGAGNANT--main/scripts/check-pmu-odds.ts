import { getCotesDirectesAvecDetails, getParticipants } from "../src/lib/pmu-api";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const date = readArg("date");
  const reunion = Number(readArg("reunion"));
  const course = Number(readArg("course"));

  if (!date || !Number.isInteger(reunion) || !Number.isInteger(course)) {
    throw new Error("Usage: npx tsx scripts/check-pmu-odds.ts --date=DDMMYYYY --reunion=1 --course=7");
  }

  const [participants, odds] = await Promise.all([
    getParticipants(date, reunion, course),
    getCotesDirectesAvecDetails(date, reunion, course),
  ]);

  const rows = participants.map((participant) => {
    const detail = odds?.get(participant.numPmu) ?? null;
    return {
      numero: participant.numPmu,
      cheval: participant.nom,
      cote: detail?.cote ?? null,
      type: detail?.typePari ?? null,
      heure: detail?.updatedAt ?? null,
      source: detail?.source ?? null,
    };
  });

  console.table(rows);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
