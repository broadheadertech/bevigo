"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const run = action({
  args: {},
  handler: async (ctx) => {
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

    // Get all modifier groups
    const groups = await ctx.runQuery(api.menu.modifierQueries.listModifierGroups, { token });
    const groupMap: Record<string, string> = {};
    for (const g of groups) {
      groupMap[g.name] = g._id;
    }

    // Coffee drinks that should have Size + Milk + Extras
    const coffeeWithMilk = [
      "Cappuccino", "Café Latte", "Flat White", "Mocha", "Dirty Matcha",
      "Spanish Latte", "Iced Latte", "Iced Mocha", "Iced Spanish Latte",
      "Iced Caramel Macchiato",
    ];

    // Coffee drinks that should have Size + Extras (no milk choice)
    const coffeeNoMilk = [
      "Espresso", "Americano", "Iced Americano", "Cold Brew", "Affogato",
    ];

    // Non-coffee with Size only
    const nonCoffeeWithSize = [
      "Matcha Latte", "Chocolate", "Chai Latte", "Strawberry Milk", "Mango Smoothie",
    ];

    let assigned = 0;

    // Assign Size to all drinks
    const allDrinks = [...coffeeWithMilk, ...coffeeNoMilk, ...nonCoffeeWithSize];
    for (const name of allDrinks) {
      if (itemMap[name] && groupMap["Size"]) {
        try {
          await ctx.runMutation(api.menu.modifierMutations.assignToItem, {
            token,
            menuItemId: itemMap[name] as any,
            modifierGroupId: groupMap["Size"] as any,
          });
          assigned++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }

    // Assign Milk to coffee drinks with milk
    for (const name of coffeeWithMilk) {
      if (itemMap[name] && groupMap["Milk"]) {
        try {
          await ctx.runMutation(api.menu.modifierMutations.assignToItem, {
            token,
            menuItemId: itemMap[name] as any,
            modifierGroupId: groupMap["Milk"] as any,
          });
          assigned++;
        } catch (e) {}
      }
    }

    // Assign Milk to non-coffee milk drinks
    for (const name of ["Matcha Latte", "Chocolate", "Chai Latte"]) {
      if (itemMap[name] && groupMap["Milk"]) {
        try {
          await ctx.runMutation(api.menu.modifierMutations.assignToItem, {
            token,
            menuItemId: itemMap[name] as any,
            modifierGroupId: groupMap["Milk"] as any,
          });
          assigned++;
        } catch (e) {}
      }
    }

    // Assign Extras to all coffee drinks
    for (const name of [...coffeeWithMilk, ...coffeeNoMilk]) {
      if (itemMap[name] && groupMap["Extras"]) {
        try {
          await ctx.runMutation(api.menu.modifierMutations.assignToItem, {
            token,
            menuItemId: itemMap[name] as any,
            modifierGroupId: groupMap["Extras"] as any,
          });
          assigned++;
        } catch (e) {}
      }
    }

    return { assigned };
  },
});
