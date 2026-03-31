"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import bcrypt from "bcryptjs";

export const seedDemoData = action({
  args: {
    ownerPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ownerPasswordHash = await bcrypt.hash(
      args.ownerPassword ?? "brewcast123",
      12
    );

    const tenantId = await ctx.runMutation(api.seedHelpers.insertTenant, {
      name: "Demo Coffee Co",
      slug: "demo-coffee-co",
      currency: "PHP",
      timezone: "Asia/Manila",
      status: "active",
      updatedAt: now,
    });

    const mainBranchId = await ctx.runMutation(api.seedHelpers.insertLocation, {
      tenantId,
      name: "Main Branch",
      slug: "main-branch",
      address: "123 Coffee Street, Makati, Metro Manila",
      timezone: "Asia/Manila",
      taxRate: 1200,
      taxLabel: "VAT",
      currency: "PHP",
      operatingHours: {
        monday: { open: "06:00", close: "22:00" },
        tuesday: { open: "06:00", close: "22:00" },
        wednesday: { open: "06:00", close: "22:00" },
        thursday: { open: "06:00", close: "22:00" },
        friday: { open: "06:00", close: "22:00" },
        saturday: { open: "07:00", close: "23:00" },
        sunday: { open: "07:00", close: "21:00" },
      },
      status: "active",
      updatedAt: now,
    });

    const airportKioskId = await ctx.runMutation(
      api.seedHelpers.insertLocation,
      {
        tenantId,
        name: "Airport Kiosk",
        slug: "airport-kiosk",
        address: "NAIA Terminal 3, Pasay City",
        timezone: "Asia/Manila",
        taxRate: 1200,
        taxLabel: "VAT",
        currency: "PHP",
        operatingHours: {
          monday: { open: "05:00", close: "22:00" },
          tuesday: { open: "05:00", close: "22:00" },
          wednesday: { open: "05:00", close: "22:00" },
          thursday: { open: "05:00", close: "22:00" },
          friday: { open: "05:00", close: "22:00" },
          saturday: { open: "05:00", close: "22:00" },
          sunday: { open: "05:00", close: "22:00" },
        },
        status: "active",
        updatedAt: now,
      }
    );

    const ownerId = await ctx.runMutation(api.seedHelpers.insertUser, {
      tenantId,
      email: "owner@democoffee.ph",
      passwordHash: ownerPasswordHash,
      name: "thebarista",
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: ownerId,
      locationId: mainBranchId,
      tenantId,
    });
    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: ownerId,
      locationId: airportKioskId,
      tenantId,
    });

    const managerId = await ctx.runMutation(api.seedHelpers.insertUser, {
      tenantId,
      email: "maria@democoffee.ph",
      name: "Maria Santos",
      role: "manager",
      status: "active",
      updatedAt: now,
    });
    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: managerId,
      locationId: mainBranchId,
      tenantId,
    });

    const barista1Id = await ctx.runMutation(api.seedHelpers.insertUser, {
      tenantId,
      name: "Juan Dela Cruz",
      role: "barista",
      status: "active",
      updatedAt: now,
    });
    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: barista1Id,
      locationId: mainBranchId,
      tenantId,
    });

    const barista2Id = await ctx.runMutation(api.seedHelpers.insertUser, {
      tenantId,
      name: "Ana Reyes",
      role: "barista",
      status: "active",
      updatedAt: now,
    });
    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: barista2Id,
      locationId: mainBranchId,
      tenantId,
    });
    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: barista2Id,
      locationId: airportKioskId,
      tenantId,
    });

    const categoryNames = ["Hot Drinks", "Iced Drinks", "Food", "Retail"];
    for (let i = 0; i < categoryNames.length; i++) {
      await ctx.runMutation(api.seedHelpers.insertCategory, {
        tenantId,
        name: categoryNames[i],
        sortOrder: i,
        status: "active",
        updatedAt: now,
      });
    }

    return {
      tenantId,
      mainBranchId,
      airportKioskId,
      ownerId,
      managerId,
      barista1Id,
      barista2Id,
      loginEmail: "owner@democoffee.ph",
      loginPassword: args.ownerPassword ?? "brewcast123",
    };
  },
});
