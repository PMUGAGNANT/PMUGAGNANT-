import { runWeeklyReport } from "../src/lib/weekly-reports";
import { printResult, readDateArg } from "./utils";

async function main() {
  const date = readDateArg();
  const referenceDate = date ? new Date(date) : undefined;
  const result = await runWeeklyReport(referenceDate);
  printResult("Weekly learning report", result);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
