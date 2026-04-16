import { genererAvisCourse, genererAvisJour } from "../src/lib/avis-pipeline";
import { getTodayDateStr } from "../src/lib/pmu-api";

const args = process.argv.slice(2);
const dateStr = args[0] ?? getTodayDateStr();
const reunion = args[1] ? Number.parseInt(args[1], 10) : null;
const course = args[2] ? Number.parseInt(args[2], 10) : null;

async function main() {
  if (reunion && course) {
    console.log(`Generation avis R${reunion}C${course}...`);
    await genererAvisCourse(dateStr, reunion, course);
  } else {
    console.log(`Generation avis journee ${dateStr}...`);
    await genererAvisJour(dateStr);
  }

  console.log("Termine.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
