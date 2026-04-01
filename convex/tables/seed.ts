import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

type TableSeed = {
  name: string;
  zone: string;
  capacity: number;
  sortOrder: number;
};

export const seedTables = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== auth.tenantId) {
      throw new Error("Location not found");
    }

    // Check if tables already exist for this location
    const existing = await ctx.db
      .query("tables")
      .withIndex("by_tenant_location", (q: any) =>
        q.eq("tenantId", auth.tenantId).eq("locationId", args.locationId)
      )
      .take(1);

    if (existing.length > 0) {
      throw new Error("Tables already exist for this location. Delete them first to re-seed.");
    }

    const seedData: TableSeed[] = [
      // Indoor tables
      { name: "Table 1", zone: "Indoor", capacity: 4, sortOrder: 1 },
      { name: "Table 2", zone: "Indoor", capacity: 4, sortOrder: 2 },
      { name: "Table 3", zone: "Indoor", capacity: 4, sortOrder: 3 },
      { name: "Table 4", zone: "Indoor", capacity: 4, sortOrder: 4 },
      { name: "Table 5", zone: "Indoor", capacity: 4, sortOrder: 5 },
      { name: "Table 6", zone: "Indoor", capacity: 4, sortOrder: 6 },
      { name: "Table 7", zone: "Indoor", capacity: 6, sortOrder: 7 },
      { name: "Table 8", zone: "Indoor", capacity: 6, sortOrder: 8 },
      // Bar
      { name: "Bar 1", zone: "Bar", capacity: 2, sortOrder: 9 },
      { name: "Bar 2", zone: "Bar", capacity: 2, sortOrder: 10 },
      { name: "Bar 3", zone: "Bar", capacity: 2, sortOrder: 11 },
      { name: "Bar 4", zone: "Bar", capacity: 2, sortOrder: 12 },
      // Outdoor
      { name: "Patio A", zone: "Outdoor", capacity: 4, sortOrder: 13 },
      { name: "Patio B", zone: "Outdoor", capacity: 4, sortOrder: 14 },
      { name: "Patio C", zone: "Outdoor", capacity: 4, sortOrder: 15 },
      { name: "Patio D", zone: "Outdoor", capacity: 4, sortOrder: 16 },
    ];

    const now = Date.now();
    for (const data of seedData) {
      await ctx.db.insert("tables", {
        tenantId: auth.tenantId,
        locationId: args.locationId,
        name: data.name,
        zone: data.zone,
        capacity: data.capacity,
        sortOrder: data.sortOrder,
        status: "active",
        updatedAt: now,
      });
    }

    return { created: seedData.length };
  },
});
