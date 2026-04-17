import { runResultSync } from "../src/lib/prediction-pipeline";
import { getTodayDateStr } from "../src/lib/pmu-api";
import { printResult, readDateArg, readOptionalNumberArg } from "./utils";

async function main() {
  const date = readDateArg() || getTodayDateStr();
  const result = await runResultSync(date, {
    reunion: readOptionalNumberArg("reunion"),
    course: readOptionalNumberArg("course"),
  });
  printResult("Results sync summary", result);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
