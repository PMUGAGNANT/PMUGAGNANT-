import { runProbabilityCalibration } from "../src/lib/probability-calibration";
import { printResult } from "./utils";

async function main() {
  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  const days = daysArg ? Number.parseInt(daysArg.split("=")[1] ?? "90", 10) : 90;
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const referenceDate = dateArg ? new Date(dateArg.split("=")[1] ?? "") : new Date();

  if (!Number.isInteger(days) || days < 1 || days > 120) {
    throw new Error("Invalid --days value. Expected integer 1-120.");
  }

  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error("Invalid --date value. Expected ISO date.");
  }

  const result = await runProbabilityCalibration(days, referenceDate);
  printResult(`Probability calibration ${days} days`, result);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
