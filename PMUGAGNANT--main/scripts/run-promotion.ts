import { runEnginePromotion } from "../src/lib/engine-promotion";
import { printResult } from "./utils";

async function main() {
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const referenceDate = dateArg ? new Date(dateArg.split("=")[1] ?? "") : new Date();

  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error("Invalid --date value. Expected ISO date.");
  }

  const result = await runEnginePromotion(referenceDate);
  printResult("Engine promotion", result);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
