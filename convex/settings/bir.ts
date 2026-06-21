import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

/**
 * BIR (Bureau of Internal Revenue, Philippines) settings management.
 *
 * Two scopes:
 *   - Tenant-wide: business identity (name, TIN, VAT status, accredited
 *     supplier). One copy per tenant.
 *   - Per-location: PTU, MIN, serial prefix/start. Each POS device gets
 *     its own from the BIR.
 *
 * Owner-only — these are tax-identity fields and should never be edited
 * by managers or baristas.
 */

export const getBirSettings = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const tenant = await ctx.db.get(session.tenantId);
    if (!tenant) return null;

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return {
      tenant: {
        businessName: tenant.businessName ?? null,
        tradeName: tenant.tradeName ?? null,
        businessAddress: tenant.businessAddress ?? null,
        tin: tenant.tin ?? null,
        vatStatus: tenant.vatStatus ?? null,
        accreditedSupplierName: tenant.accreditedSupplierName ?? null,
        accreditedSupplierAccreditation:
          tenant.accreditedSupplierAccreditation ?? null,
        accreditedSupplierDateIssued:
          tenant.accreditedSupplierDateIssued ?? null,
        accreditedSupplierDateValid:
          tenant.accreditedSupplierDateValid ?? null,
      },
      locations: locations.map((l) => ({
        _id: l._id,
        name: l.name,
        slug: l.slug,
        birPermitNumber: l.birPermitNumber ?? null,
        birMin: l.birMin ?? null,
        birAtpNumber: l.birAtpNumber ?? null,
        birSerialPrefix: l.birSerialPrefix ?? null,
        birSerialStart: l.birSerialStart ?? null,
        birMachineSerial: l.birMachineSerial ?? null,
        storeCode: l.storeCode ?? null,
        terminalNo: l.terminalNo ?? null,
        zCounter: l.zCounter ?? 0,
        grandTotalAccumulated: l.grandTotalAccumulated ?? 0,
      })),
    };
  },
});

const TIN_PATTERN = /^\d{3}-?\d{3}-?\d{3}-?\d{3,5}$/;

export const updateTenantBir = mutation({
  args: {
    token: v.string(),
    businessName: v.optional(v.string()),
    tradeName: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatStatus: v.optional(
      v.union(
        v.literal("vat"),
        v.literal("non_vat"),
        v.literal("vat_exempt")
      )
    ),
    accreditedSupplierName: v.optional(v.string()),
    accreditedSupplierAccreditation: v.optional(v.string()),
    accreditedSupplierDateIssued: v.optional(v.number()),
    accreditedSupplierDateValid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.tin && args.tin.trim() && !TIN_PATTERN.test(args.tin.trim())) {
      throw new Error(
        "TIN must be 12 or 12+5 digits (e.g. 123-456-789-00001)"
      );
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.businessName !== undefined)
      patch.businessName = args.businessName.trim() || undefined;
    if (args.tradeName !== undefined)
      patch.tradeName = args.tradeName.trim() || undefined;
    if (args.businessAddress !== undefined)
      patch.businessAddress = args.businessAddress.trim() || undefined;
    if (args.tin !== undefined) patch.tin = args.tin.trim() || undefined;
    if (args.vatStatus !== undefined) patch.vatStatus = args.vatStatus;
    if (args.accreditedSupplierName !== undefined)
      patch.accreditedSupplierName =
        args.accreditedSupplierName.trim() || undefined;
    if (args.accreditedSupplierAccreditation !== undefined)
      patch.accreditedSupplierAccreditation =
        args.accreditedSupplierAccreditation.trim() || undefined;
    if (args.accreditedSupplierDateIssued !== undefined)
      patch.accreditedSupplierDateIssued = args.accreditedSupplierDateIssued;
    if (args.accreditedSupplierDateValid !== undefined)
      patch.accreditedSupplierDateValid = args.accreditedSupplierDateValid;

    await ctx.db.patch(session.tenantId, patch);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "bir.tenant_updated",
      "tenants",
      session.tenantId,
      patch as Record<string, unknown>
    );
  },
});

export const updateLocationBir = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    birPermitNumber: v.optional(v.string()),
    birMin: v.optional(v.string()),
    birAtpNumber: v.optional(v.string()),
    birSerialPrefix: v.optional(v.string()),
    birSerialStart: v.optional(v.number()),
    birMachineSerial: v.optional(v.string()),
    storeCode: v.optional(v.string()),
    terminalNo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    if (
      args.birSerialStart !== undefined &&
      (args.birSerialStart < 1 || !Number.isInteger(args.birSerialStart))
    ) {
      throw new Error("Serial start must be a positive integer");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.birPermitNumber !== undefined)
      patch.birPermitNumber = args.birPermitNumber.trim() || undefined;
    if (args.birMin !== undefined)
      patch.birMin = args.birMin.trim() || undefined;
    if (args.birAtpNumber !== undefined)
      patch.birAtpNumber = args.birAtpNumber.trim() || undefined;
    if (args.birSerialPrefix !== undefined)
      patch.birSerialPrefix = args.birSerialPrefix.trim() || undefined;
    if (args.birSerialStart !== undefined)
      patch.birSerialStart = args.birSerialStart;
    if (args.birMachineSerial !== undefined)
      patch.birMachineSerial = args.birMachineSerial.trim() || undefined;
    if (args.storeCode !== undefined)
      patch.storeCode = args.storeCode.trim() || undefined;
    if (args.terminalNo !== undefined) patch.terminalNo = args.terminalNo;

    await ctx.db.patch(args.locationId, patch);

    // Initialise the serial counter the first time a start is set, so the
    // next completeOrder() can begin issuing serials immediately.
    if (args.birSerialStart !== undefined) {
      const existing = await ctx.db
        .query("orderSerialCounters")
        .withIndex("by_location", (q) =>
          q.eq("locationId", args.locationId)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          currentSerial: args.birSerialStart - 1, // next issue = start
          prefix: args.birSerialPrefix ?? existing.prefix,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("orderSerialCounters", {
          tenantId: session.tenantId,
          locationId: args.locationId,
          currentSerial: args.birSerialStart - 1,
          prefix: args.birSerialPrefix ?? "",
          updatedAt: Date.now(),
        });
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "bir.location_updated",
      "locations",
      args.locationId,
      patch as Record<string, unknown>
    );
  },
});

/**
 * Reserved (consume the next serial) — called inside completeOrder. Uses
 * an upsert + OCC retry pattern so two concurrent completions don't
 * collide on the same number. Returns the formatted serial string.
 */
export async function issueBirSerial(
  ctx: { db: { query: any; patch: any; insert: any; get: any } } & Record<string, any>,
  tenantId: any,
  locationId: any,
  fallbackPrefix: string
): Promise<string | null> {
  const existing = await ctx.db
    .query("orderSerialCounters")
    .withIndex("by_location", (q: any) => q.eq("locationId", locationId))
    .unique();

  if (!existing) {
    // No counter configured yet — bail. Receipt prints without a BIR
    // serial until Settings → BIR is filled in.
    return null;
  }

  const next = existing.currentSerial + 1;
  await ctx.db.patch(existing._id, {
    currentSerial: next,
    updatedAt: Date.now(),
  });

  const prefix = existing.prefix || fallbackPrefix || "OR-";
  return `${prefix}${String(next).padStart(8, "0")}`;
}
