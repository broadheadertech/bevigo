import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

type SearchResult = {
  type: "menu_item" | "ingredient" | "staff";
  id: string;
  name: string;
  subtitle: string;
  href: string;
};

export const globalSearch = query({
  args: {
    token: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    const searchQuery = args.query.toLowerCase().trim();
    if (!searchQuery) return [];

    const effectiveLimit = args.limit ?? 10;
    const results: SearchResult[] = [];

    // Search menu items
    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const matchingMenuItems = menuItems
      .filter((item: Doc<"menuItems">) =>
        item.name.toLowerCase().includes(searchQuery)
      )
      .slice(0, 5);

    for (const item of matchingMenuItems) {
      const typedItem = item as Doc<"menuItems">;
      results.push({
        type: "menu_item",
        id: typedItem._id,
        name: typedItem.name,
        subtitle: `${typedItem.status} · ${(typedItem.basePrice / 100).toFixed(2)}`,
        href: "/menu",
      });
    }

    // Search ingredients
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const matchingIngredients = ingredients
      .filter((ing: Doc<"ingredients">) =>
        ing.name.toLowerCase().includes(searchQuery)
      )
      .slice(0, 5);

    for (const ing of matchingIngredients) {
      const typedIng = ing as Doc<"ingredients">;
      results.push({
        type: "ingredient",
        id: typedIng._id,
        name: typedIng.name,
        subtitle: `${typedIng.unit} · ${typedIng.status}`,
        href: "/inventory",
      });
    }

    // Search staff
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const matchingUsers = users
      .filter(
        (user: Doc<"users">) =>
          user.name.toLowerCase().includes(searchQuery) ||
          (user.email && user.email.toLowerCase().includes(searchQuery))
      )
      .slice(0, 5);

    for (const user of matchingUsers) {
      const typedUser = user as Doc<"users">;
      results.push({
        type: "staff",
        id: typedUser._id,
        name: typedUser.name,
        subtitle: `${typedUser.role} · ${typedUser.status}`,
        href: "/staff",
      });
    }

    return results.slice(0, effectiveLimit);
  },
});
