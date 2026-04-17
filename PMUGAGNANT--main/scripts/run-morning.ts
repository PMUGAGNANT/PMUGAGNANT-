import { runMorningAnalysis } from "../src/lib/prediction-pipeline";
import { getTodayDateStr } from "../src/lib/pmu-api";
import { printResult, readDateArg } from "./utils";

async function main() {
  const date = readDateArg() || getTodayDateStr();
  const result = await runMorningAnalysis(date);
  printResult("Morning analysis summary", result);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
