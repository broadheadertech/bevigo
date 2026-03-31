import { internalMutation } from "../_generated/server";

const BATCH_SIZE = 100;

export const deleteExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Use by_expiry index to efficiently find expired sessions
    const expiredSessions = await ctx.db
      .query("sessions")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(BATCH_SIZE);

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    // If we hit the batch limit, the next hourly cron will pick up remaining ones
    return { deleted: expiredSessions.length };
  },
});
