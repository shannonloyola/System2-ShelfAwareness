import cron from "node-cron";
import { env } from "../config/env.js";
import { recalculateAllSupplierScorecards } from "./scorecardCache.js";

let started = false;

export const startMonthlyScorecardScheduler = () => {
  if (started) return;
  started = true;

  cron.schedule(
    "0 0 1 * *",
    async () => {
      console.log(
        `[scheduler] Starting monthly supplier scorecard recalculation at ${new Date().toISOString()}`,
      );

      try {
        const result = await recalculateAllSupplierScorecards();
        console.log(
          `[scheduler] Recalculated ${result.count} supplier scorecards for ${result.source_month}.`,
        );
      } catch (error) {
        console.error(
          "[scheduler] Monthly scorecard recalculation failed:",
          error instanceof Error ? error.message : error,
        );
      }
    },
    {
      timezone: env.cronTimezone,
    },
  );

  console.log(
    `[scheduler] Monthly scorecard job scheduled for 00:00 on day 1 (${env.cronTimezone}).`,
  );
};
