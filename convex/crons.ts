import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Story 1.5: Clean up expired sessions every hour
crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  internal.auth.sessionCleanup.deleteExpiredSessions
);

export default crons;
