import { genererAvisCourse, genererAvisJour } from "../src/lib/avis-pipeline";
import { getTodayDateStr } from "../src/lib/pmu-api";

const args = process.argv.slice(2);
const dateStr = args[0] ?? getTodayDateStr();
const reunion = args[1] ? Number.parseInt(args[1], 10) : null;
const course = args[2] ? Number.parseInt(args[2], 10) : null;

async function main() {
  if (reunion && course) {
    process.stdout.write(`Generation avis R${reunion}C${course}...\n`);
    await genererAvisCourse(dateStr, reunion, course);
  } else {
    process.stdout.write(`Generation avis journee ${dateStr}...\n`);
    await genererAvisJour(dateStr);
  }

  process.stdout.write("Termine.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
