import { runEngineLearning } from "../src/lib/engine-learning";
import { printResult } from "./utils";

async function main() {
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const referenceDate = dateArg ? new Date(dateArg.split("=")[1] ?? "") : new Date();

  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error("Invalid --date value. Expected ISO date.");
  }

  const result = await runEngineLearning(referenceDate);
  printResult("Engine learning windows", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
