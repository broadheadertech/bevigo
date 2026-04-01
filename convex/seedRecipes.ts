"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const seedRecipes = action({
  args: {},
  handler: async (ctx) => {
    // Login
    const { token } = await ctx.runAction(api.auth.login.login, {
      email: "owner@democoffee.ph",
      password: "brewcast123",
    });

    // Get all menu items
    const items = await ctx.runQuery(api.menu.queries.listItems, { token });
    const itemMap: Record<string, string> = {};
    for (const item of items) {
      itemMap[item.name] = item._id;
    }

    // Get all ingredients
    const locations = await ctx.runQuery(api.settings.queries.listLocations, { token });
    const loc = locations[0];
    const ingredients = await ctx.runQuery(api.inventory.queries.listIngredients, {
      token,
      locationId: loc._id,
    });
    const ingMap: Record<string, string> = {};
    for (const ing of ingredients) {
      ingMap[ing.name] = ing._id;
    }

    // Recipe definitions: item name → [{ ingredient name, quantity used per serving }]
    const recipes: Record<string, Array<{ ing: string; qty: number }>> = {
      // Hot Coffee
      "Espresso": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Americano": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Cappuccino": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 150 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Café Latte": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 200 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Flat White": [
        { ing: "Espresso Beans", qty: 36 },
        { ing: "Whole Milk", qty: 150 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Mocha": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 180 },
        { ing: "Chocolate Syrup", qty: 30 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Dirty Matcha": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Matcha Powder", qty: 3 },
        { ing: "Whole Milk", qty: 200 },
        { ing: "Cups 8oz", qty: 1 },
      ],
      "Spanish Latte": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 150 },
        { ing: "Sugar", qty: 20 },
        { ing: "Cups 8oz", qty: 1 },
      ],

      // Iced Coffee
      "Iced Americano": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Iced Latte": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 200 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Iced Mocha": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 180 },
        { ing: "Chocolate Syrup", qty: 30 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Iced Spanish Latte": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 150 },
        { ing: "Sugar", qty: 20 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Cold Brew": [
        { ing: "Espresso Beans", qty: 25 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Iced Caramel Macchiato": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Whole Milk", qty: 200 },
        { ing: "Vanilla Syrup", qty: 15 },
        { ing: "Caramel Syrup", qty: 15 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Affogato": [
        { ing: "Espresso Beans", qty: 18 },
        { ing: "Cups 8oz", qty: 1 },
      ],

      // Non-Coffee
      "Matcha Latte": [
        { ing: "Matcha Powder", qty: 4 },
        { ing: "Whole Milk", qty: 250 },
        { ing: "Cups 12oz", qty: 1 },
      ],
      "Chocolate": [
        { ing: "Chocolate Syrup", qty: 40 },
        { ing: "Whole Milk", qty: 250 },
        { ing: "Cups 12oz", qty: 1 },
      ],
      "Chai Latte": [
        { ing: "Whole Milk", qty: 250 },
        { ing: "Cups 12oz", qty: 1 },
      ],
      "Strawberry Milk": [
        { ing: "Whole Milk", qty: 250 },
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],
      "Mango Smoothie": [
        { ing: "Cups 16oz", qty: 1 },
        { ing: "Lids", qty: 1 },
      ],

      // Food
      "Croissant": [
        { ing: "Croissants (frozen)", qty: 1 },
      ],
      "Chicken Pesto Panini": [
        { ing: "Bread Loaf", qty: 0.25 },
      ],
      "Egg & Cheese Sandwich": [
        { ing: "Bread Loaf", qty: 0.25 },
      ],
      "Banana Bread": [
        { ing: "Bread Loaf", qty: 0.2 },
      ],
    };

    let created = 0;
    for (const [itemName, recipeItems] of Object.entries(recipes)) {
      const menuItemId = itemMap[itemName];
      if (!menuItemId) continue;

      for (const r of recipeItems) {
        const ingredientId = ingMap[r.ing];
        if (!ingredientId) continue;

        try {
          await ctx.runMutation(api.inventory.recipeMutations.addRecipeItem, {
            token,
            menuItemId: menuItemId as any,
            ingredientId: ingredientId as any,
            quantityUsed: r.qty,
          });
          created++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }

    return { recipesCreated: created };
  },
});
