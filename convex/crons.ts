import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Story 1.5: Clean up expired sessions every hour
crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  internal.auth.sessionCleanup.deleteExpiredSessions
);

// Auto clock-out inactive timesheets
crons.interval(
  "auto clock out",
  { hours: 1 },
  internal.timesheets.cron.autoClockOutInactive
);

// Hourly: dispatch scheduled email reports (mid-day + end-of-day) per tenant timezone
crons.cron(
  "dispatch scheduled reports",
  "0 * * * *",
  internal.reports.cron.dispatchScheduledReports
);

export default crons;
