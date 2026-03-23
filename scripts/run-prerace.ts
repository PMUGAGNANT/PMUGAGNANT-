import { runPreRaceSecondPass } from "../src/lib/prediction-pipeline";
import { getTodayDateStr } from "../src/lib/pmu-api";
import { printResult, readDateArg, readOptionalNumberArg } from "./utils";

async function main() {
  const date = readDateArg() || getTodayDateStr();
  const result = await runPreRaceSecondPass(date, {
    reunion: readOptionalNumberArg("reunion"),
    course: readOptionalNumberArg("course"),
  });
  printResult("Pre-race second-pass summary", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
