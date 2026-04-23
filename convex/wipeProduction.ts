import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";

/**
 * DESTRUCTIVE — wipes all production data EXCEPT:
 *   - the tenant doc(s)
 *   - users with role = "owner"
 *   - userLocations linking those owners
 *   - locations the kept owners have access to
 *
 * Requires confirmString === "WIPE_PRODUCTION" so it can't be triggered
 * accidentally (e.g. a fat-finger `npx convex run`).
 *
 * Run from your terminal pointed at the prod deployment:
 *   npx convex run --prod wipeProduction:wipeAllExceptOwners \
 *     --args '{"confirmString":"WIPE_PRODUCTION"}'
 */
export const wipeAllExceptOwners = mutation({
  args: {
    confirmString: v.string(),
  },
  handler: async (ctx, args) => {
    // Be lenient on whitespace + case so PowerShell / CMD quoting doesn't
    // bite. The string itself still has to be intentional.
    const normalized = (args.confirmString ?? "")
      .trim()
      .toUpperCase()
      .replace(/^["']|["']$/g, "");
    if (normalized !== "WIPE_PRODUCTION") {
      throw new Error(
        `Refusing to wipe — confirmString must be "WIPE_PRODUCTION" (received: ${JSON.stringify(args.confirmString)}).`
      );
    }

    // Figure out who/what to keep BEFORE deleting anything.
    const allUsers = await ctx.db.query("users").collect();
    const ownerIds = new Set(
      allUsers.filter((u) => u.role === "owner").map((u) => u._id as string)
    );

    const allUserLocations = await ctx.db.query("userLocations").collect();
    const keptUserLocations = allUserLocations.filter((ul) =>
      ownerIds.has(ul.userId as string)
    );
    const locationsToKeep = new Set(
      keptUserLocations.map((ul) => ul.locationId as string)
    );

    // Tables that get fully cleared — every row deleted.
    const fullWipeTables: TableNames[] = [
      "timesheets",
      "timesheetBreaks",
      "timesheetEdits",
      "sessions",
      "tenantSettings",
      "pinFailures",
      "categories",
      "menuItems",
      "modifierGroups",
      "modifiers",
      "menuItemModifierGroups",
      "locationPriceOverrides",
      "orders",
      "orderItems",
      "orderItemModifiers",
      "ingredients",
      "ingredientStock",
      "recipes",
      "modifierRecipes",
      "purchaseOrders",
      "purchaseOrderItems",
      "stockAdjustments",
      "shifts",
      "customers",
      "discountPresets",
      "pointsLedger",
      "rewards",
      "loyaltyCards",
      "subscriptionPlans",
      "tenantSubscriptions",
      "tables",
      "floors",
      "tableZones",
      "auditLog",
      "payPeriods",
      "payslips",
      "staffRecurringDeductions",
      "staffLoans",
      "staffLoanPayments",
    ];

    const counts: Record<string, number> = {};
    for (const table of fullWipeTables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    // users — keep only owners
    let usersDeleted = 0;
    for (const u of allUsers) {
      if (!ownerIds.has(u._id as string)) {
        await ctx.db.delete(u._id);
        usersDeleted++;
      }
    }
    counts.users = usersDeleted;

    // userLocations — keep only those for kept owners
    let userLocationsDeleted = 0;
    for (const ul of allUserLocations) {
      if (!ownerIds.has(ul.userId as string)) {
        await ctx.db.delete(ul._id);
        userLocationsDeleted++;
      }
    }
    counts.userLocations = userLocationsDeleted;

    // locations — keep only those linked to kept owners
    const allLocations = await ctx.db.query("locations").collect();
    let locationsDeleted = 0;
    for (const loc of allLocations) {
      if (!locationsToKeep.has(loc._id as string)) {
        await ctx.db.delete(loc._id);
        locationsDeleted++;
      }
    }
    counts.locations = locationsDeleted;

    // tenants — kept as-is (the seeded Bevigo tenant stays).
    counts.tenants = 0;

    return {
      kept: {
        tenants: (await ctx.db.query("tenants").collect()).length,
        users: ownerIds.size,
        userLocations: keptUserLocations.length,
        locations: locationsToKeep.size,
      },
      deleted: counts,
      message:
        "Wipe complete. Owners, their locations, and the tenant doc are intact.",
    };
  },
});
