import { mutation } from "./_generated/server";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const customers = await ctx.db.query("customers").collect();
    let backfilled = 0;
    for (let i = 0; i < customers.length; i++) {
      if (!customers[i].customerNumber) {
        backfilled++;
        await ctx.db.patch(customers[i]._id, {
          customerNumber: `BG-${String(i + 1).padStart(4, "0")}`,
        });
      }
    }
    return { backfilled, total: customers.length };
  },
});
