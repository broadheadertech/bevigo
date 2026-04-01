"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import bcrypt from "bcryptjs";

export const seedFullData = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // ── Get existing tenant + owner ──
    // Find the owner user we seeded earlier
    const staffList = await ctx.runQuery(api.staff.queries.list, {
      token: "", // We need a valid token — let's create data via direct mutations instead
    }).catch(() => null);

    // We'll use the seedHelpers mutations directly since they don't require auth
    // First, find existing tenant
    const existingOwner = await ctx.runQuery(api.auth.loginHelpers.findUserByEmail, {
      email: "owner@democoffee.ph",
    });

    if (!existingOwner) {
      return { error: "Run seed:seedDemoData first to create the tenant and owner" };
    }

    const tenantId = existingOwner.tenantId;

    // Get locations
    const locations = await ctx.runMutation(api.seedHelpers.insertCategory, {
      tenantId,
      name: "__temp__",
      sortOrder: 999,
      status: "active",
      updatedAt: now,
    }).catch(() => null);

    // Actually, let's just use internal mutations for everything
    // We need the location IDs — query them

    // ── Create Menu Categories ──
    // Categories were already seeded (Hot Drinks, Iced Drinks, Food, Retail)
    // Let's add menu items to them

    // We need to log in to get a token, then use the API
    const loginResult = await ctx.runAction(api.auth.login.login, {
      email: "owner@democoffee.ph",
      password: "brewcast123",
    });

    const token = loginResult.token;

    // Get existing categories
    const categories = await ctx.runQuery(api.menu.queries.listCategories, { token });

    const catMap: Record<string, string> = {};
    for (const cat of categories) {
      catMap[cat.name] = cat._id;
    }

    // If categories are empty, create them
    if (Object.keys(catMap).length === 0) {
      const catNames = ["Hot Coffee", "Iced Coffee", "Non-Coffee", "Food", "Retail"];
      for (let i = 0; i < catNames.length; i++) {
        const id = await ctx.runMutation(api.menu.mutations.createCategory, {
          token,
          name: catNames[i],
          sortOrder: i,
        });
        catMap[catNames[i]] = id;
      }
    }

    // ── Create Menu Items ──
    const menuItems = [
      // Hot Coffee
      { name: "Espresso", cat: "Hot Coffee", price: 12000, featured: false, desc: "Single shot of rich espresso" },
      { name: "Americano", cat: "Hot Coffee", price: 14000, featured: false, desc: "Espresso with hot water" },
      { name: "Cappuccino", cat: "Hot Coffee", price: 16000, featured: true, desc: "Espresso with steamed milk foam" },
      { name: "Café Latte", cat: "Hot Coffee", price: 16000, featured: false, desc: "Espresso with steamed milk" },
      { name: "Flat White", cat: "Hot Coffee", price: 17000, featured: false, desc: "Double espresso with velvety milk" },
      { name: "Mocha", cat: "Hot Coffee", price: 18000, featured: false, desc: "Espresso with chocolate and steamed milk" },
      { name: "Dirty Matcha", cat: "Hot Coffee", price: 19000, featured: true, desc: "Matcha latte with espresso shot" },
      { name: "Spanish Latte", cat: "Hot Coffee", price: 17000, featured: false, desc: "Espresso with condensed milk" },

      // Iced Coffee
      { name: "Iced Americano", cat: "Iced Coffee", price: 15000, featured: true, desc: "Espresso with cold water over ice" },
      { name: "Iced Latte", cat: "Iced Coffee", price: 17000, featured: false, desc: "Espresso with cold milk over ice" },
      { name: "Iced Mocha", cat: "Iced Coffee", price: 19000, featured: false, desc: "Espresso with chocolate milk over ice" },
      { name: "Iced Spanish Latte", cat: "Iced Coffee", price: 18000, featured: true, desc: "Espresso with condensed milk over ice" },
      { name: "Cold Brew", cat: "Iced Coffee", price: 16000, featured: false, desc: "24-hour cold steeped coffee" },
      { name: "Iced Caramel Macchiato", cat: "Iced Coffee", price: 19000, featured: false, desc: "Vanilla, milk, espresso, caramel drizzle" },
      { name: "Affogato", cat: "Iced Coffee", price: 18000, featured: false, desc: "Vanilla ice cream with espresso" },

      // Non-Coffee
      { name: "Matcha Latte", cat: "Non-Coffee", price: 17000, featured: false, desc: "Japanese matcha with steamed milk" },
      { name: "Chocolate", cat: "Non-Coffee", price: 15000, featured: false, desc: "Rich hot chocolate" },
      { name: "Chai Latte", cat: "Non-Coffee", price: 16000, featured: false, desc: "Spiced chai with steamed milk" },
      { name: "Strawberry Milk", cat: "Non-Coffee", price: 15000, featured: false, desc: "Fresh strawberry with cold milk" },
      { name: "Mango Smoothie", cat: "Non-Coffee", price: 16000, featured: false, desc: "Blended fresh mango" },

      // Food
      { name: "Croissant", cat: "Food", price: 9500, featured: false, desc: "Butter croissant" },
      { name: "Chicken Pesto Panini", cat: "Food", price: 18000, featured: true, desc: "Grilled panini with chicken and pesto" },
      { name: "Egg & Cheese Sandwich", cat: "Food", price: 14000, featured: false, desc: "Scrambled egg with cheese on ciabatta" },
      { name: "Banana Bread", cat: "Food", price: 8500, featured: false, desc: "Homemade banana bread slice" },
      { name: "Cookie", cat: "Food", price: 7500, featured: false, desc: "Chocolate chip cookie" },
      { name: "Cheesecake Slice", cat: "Food", price: 16000, featured: false, desc: "New York style cheesecake" },

      // Retail
      { name: "House Blend Beans (250g)", cat: "Retail", price: 45000, featured: false, desc: "Our signature house blend" },
      { name: "Single Origin Ethiopia (250g)", cat: "Retail", price: 55000, featured: false, desc: "Yirgacheffe, washed process" },
      { name: "Ceramic Mug", cat: "Retail", price: 35000, featured: false, desc: "bevi&go branded mug" },
    ];

    // Check for category name mapping — use existing categories
    const getCatId = (catName: string) => {
      // Try exact match first
      if (catMap[catName]) return catMap[catName];
      // Try partial match
      for (const [key, id] of Object.entries(catMap)) {
        if (key.toLowerCase().includes(catName.toLowerCase().split(" ")[0])) return id;
      }
      // Fallback to first category
      return Object.values(catMap)[0];
    };

    const createdItems: string[] = [];
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      try {
        const id = await ctx.runMutation(api.menu.mutations.createItem, {
          token,
          categoryId: getCatId(item.cat) as any,
          name: item.name,
          description: item.desc,
          basePrice: item.price,
          isFeatured: item.featured,
          sortOrder: i,
        });
        createdItems.push(item.name);
      } catch (e) {
        // Skip if already exists
      }
    }

    // ── Create Modifier Groups ──
    const sizeGroupId = await ctx.runMutation(api.menu.modifierMutations.createModifierGroup, {
      token,
      name: "Size",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
    });

    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: sizeGroupId, name: "Small (8oz)", priceAdjustment: 0, sortOrder: 0,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: sizeGroupId, name: "Medium (12oz)", priceAdjustment: 2000, sortOrder: 1,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: sizeGroupId, name: "Large (16oz)", priceAdjustment: 4000, sortOrder: 2,
    });

    const milkGroupId = await ctx.runMutation(api.menu.modifierMutations.createModifierGroup, {
      token,
      name: "Milk",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 1,
    });

    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: milkGroupId, name: "Whole Milk", priceAdjustment: 0, sortOrder: 0,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: milkGroupId, name: "Oat Milk", priceAdjustment: 3000, sortOrder: 1,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: milkGroupId, name: "Almond Milk", priceAdjustment: 3000, sortOrder: 2,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: milkGroupId, name: "Soy Milk", priceAdjustment: 2000, sortOrder: 3,
    });

    const extrasGroupId = await ctx.runMutation(api.menu.modifierMutations.createModifierGroup, {
      token,
      name: "Extras",
      required: false,
      minSelect: 0,
      maxSelect: 3,
      sortOrder: 2,
    });

    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: extrasGroupId, name: "Extra Shot", priceAdjustment: 3000, sortOrder: 0,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: extrasGroupId, name: "Vanilla Syrup", priceAdjustment: 2000, sortOrder: 1,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: extrasGroupId, name: "Caramel Syrup", priceAdjustment: 2000, sortOrder: 2,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: extrasGroupId, name: "Hazelnut Syrup", priceAdjustment: 2000, sortOrder: 3,
    });
    await ctx.runMutation(api.menu.modifierMutations.addModifier, {
      token, groupId: extrasGroupId, name: "Whipped Cream", priceAdjustment: 1500, sortOrder: 4,
    });

    // ── Create Ingredients ──
    const ingredients = [
      { name: "Espresso Beans", unit: "g", category: "Coffee", threshold: 500 },
      { name: "Whole Milk", unit: "ml", category: "Dairy", threshold: 2000 },
      { name: "Oat Milk", unit: "ml", category: "Dairy", threshold: 1000 },
      { name: "Almond Milk", unit: "ml", category: "Dairy", threshold: 1000 },
      { name: "Matcha Powder", unit: "g", category: "Tea", threshold: 100 },
      { name: "Chocolate Syrup", unit: "ml", category: "Syrups", threshold: 500 },
      { name: "Vanilla Syrup", unit: "ml", category: "Syrups", threshold: 500 },
      { name: "Caramel Syrup", unit: "ml", category: "Syrups", threshold: 500 },
      { name: "Sugar", unit: "g", category: "Supplies", threshold: 1000 },
      { name: "Cups 8oz", unit: "pcs", category: "Supplies", threshold: 50 },
      { name: "Cups 12oz", unit: "pcs", category: "Supplies", threshold: 50 },
      { name: "Cups 16oz", unit: "pcs", category: "Supplies", threshold: 50 },
      { name: "Lids", unit: "pcs", category: "Supplies", threshold: 50 },
      { name: "Croissants (frozen)", unit: "pcs", category: "Food", threshold: 10 },
      { name: "Bread Loaf", unit: "pcs", category: "Food", threshold: 5 },
    ];

    const ingredientIds: Record<string, string> = {};
    for (const ing of ingredients) {
      try {
        const id = await ctx.runMutation(api.inventory.mutations.createIngredient, {
          token,
          name: ing.name,
          unit: ing.unit,
          category: ing.category,
          reorderThreshold: ing.threshold,
        });
        ingredientIds[ing.name] = id;
      } catch (e) {
        // Skip if exists
      }
    }

    // ── Set Stock Levels ──
    // Get the main branch location
    const allLocations = await ctx.runQuery(api.settings.queries.listLocations, { token });
    const mainBranch = allLocations.find((l: any) => l.slug === "main-branch");

    if (mainBranch && Object.keys(ingredientIds).length > 0) {
      const stockLevels: Record<string, number> = {
        "Espresso Beans": 2500,
        "Whole Milk": 8000,
        "Oat Milk": 3000,
        "Almond Milk": 2000,
        "Matcha Powder": 300,
        "Chocolate Syrup": 1500,
        "Vanilla Syrup": 1200,
        "Caramel Syrup": 800,
        "Sugar": 3000,
        "Cups 8oz": 200,
        "Cups 12oz": 150,
        "Cups 16oz": 100,
        "Lids": 400,
        "Croissants (frozen)": 25,
        "Bread Loaf": 8,
      };

      for (const [name, qty] of Object.entries(stockLevels)) {
        if (ingredientIds[name]) {
          try {
            await ctx.runMutation(api.inventory.mutations.setStock, {
              token,
              ingredientId: ingredientIds[name] as any,
              locationId: mainBranch._id as any,
              quantity: qty,
            });
          } catch (e) {
            // Skip
          }
        }
      }
    }

    // ── Create a Customer ──
    try {
      await ctx.runMutation(api.customers.mutations.createCustomer, {
        token,
        name: "Maria Clara",
        phone: "09171234567",
        email: "maria@email.com",
      });
      await ctx.runMutation(api.customers.mutations.createCustomer, {
        token,
        name: "Juan Luna",
        phone: "09181234567",
      });
      await ctx.runMutation(api.customers.mutations.createCustomer, {
        token,
        name: "Jose Rizal",
        phone: "09191234567",
        email: "jose@email.com",
      });
    } catch (e) {
      // Skip if exists
    }

    // ── Seed Billing Plans (if not already done) ──
    try {
      await ctx.runMutation(api.billing.seedPlans.seedDefaultPlans, {});
    } catch (e) {
      // Already seeded
    }

    return {
      menuItemsCreated: createdItems.length,
      ingredientsCreated: Object.keys(ingredientIds).length,
      modifierGroups: 3,
      customers: 3,
      message: "Full demo data seeded successfully!",
    };
  },
});
