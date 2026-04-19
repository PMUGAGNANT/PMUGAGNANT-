import "./load-env";
import { runBacktestV101 } from "@/lib/predictions/backtest-v10-1";

runBacktestV101()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
