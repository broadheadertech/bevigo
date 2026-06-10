import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * BIR serial pre-allocation for offline mode.
 *
 * A device — laptop, tablet, mounted POS — asks the server to atomically
 * reserve a block of N consecutive serials from the gap-less counter for
 * its location. While offline (or anytime, really), the device burns
 * through that block locally. When the order replays online, completeOrder
 * receives the serial the client used and validates it against an active
 * reservation owned by the same device. The reservation row is the audit
 * trail the BIR auditor needs to explain why this device printed
 * "OR-MAIN-00001234" two hours before the next online order in the log.
 *
 * Block expiry: 7 days. Any unused tail of an expired reservation becomes
 * documented "void / cancelled" range — surfaced in BIR settings so the
 * operator can file it.
 */

const DEFAULT_BLOCK_SIZE = 50;
const MAX_BLOCK_SIZE = 200;
const RESERVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Reserve a block of N serials for a device. Atomic: bumps the location's
 * serial counter past the block and writes a single reservation row. Two
 * concurrent calls land in different transactions thanks to Convex OCC.
 *
 * If the location's BIR settings haven't been filled in yet (no counter
 * exists), returns null — the caller falls back to printing without a
 * serial, the same way completeOrder behaves online.
 */
export const reserveSerialBlock = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    deviceId: v.string(),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    if (!args.deviceId || args.deviceId.length < 8) {
      throw new Error("Device id required (≥ 8 chars)");
    }

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const size = Math.max(1, Math.min(args.size ?? DEFAULT_BLOCK_SIZE, MAX_BLOCK_SIZE));

    // If the device already has an active reservation with capacity, hand
    // it back instead of allocating a new block. Avoids burning serial
    // numbers every time the page reloads.
    const existing = await ctx.db
      .query("orderSerialReservations")
      .withIndex("by_location_device", (q) =>
        q.eq("locationId", args.locationId).eq("deviceId", args.deviceId)
      )
      .collect();
    const reusable = existing.find(
      (r) =>
        r.status === "active" &&
        r.usedThrough < r.toSerial &&
        r.expiresAt > Date.now()
    );
    if (reusable) {
      return {
        reservationId: reusable._id,
        fromSerial: reusable.fromSerial,
        toSerial: reusable.toSerial,
        usedThrough: reusable.usedThrough,
        prefix: reusable.prefix,
        expiresAt: reusable.expiresAt,
        reused: true,
      };
    }

    // Allocate from the gap-less counter.
    const counter = await ctx.db
      .query("orderSerialCounters")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .unique();
    if (!counter) {
      // No BIR settings — caller knows to skip pre-allocation.
      return null;
    }

    const fromSerial = counter.currentSerial + 1;
    const toSerial = counter.currentSerial + size;
    await ctx.db.patch(counter._id, {
      currentSerial: toSerial,
      updatedAt: Date.now(),
    });

    const reservationId = await ctx.db.insert("orderSerialReservations", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      deviceId: args.deviceId,
      prefix: counter.prefix,
      fromSerial,
      toSerial,
      usedThrough: 0,
      status: "active",
      expiresAt: Date.now() + RESERVATION_TTL_MS,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "bir.serial_block_reserved",
      "orderSerialReservations",
      reservationId,
      { fromSerial, toSerial, deviceId: args.deviceId }
    );

    return {
      reservationId,
      fromSerial,
      toSerial,
      usedThrough: 0,
      prefix: counter.prefix,
      expiresAt: Date.now() + RESERVATION_TTL_MS,
      reused: false,
    };
  },
});

/**
 * Read view of every reservation for a location — operator-facing list
 * on the BIR settings page so they can see active blocks and how many
 * serials are unaccounted for.
 */
export const listReservations = query({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) return [];

    const rows = await ctx.db
      .query("orderSerialReservations")
      .withIndex("by_location_status", (q) =>
        q.eq("locationId", args.locationId)
      )
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

/**
 * Tenant-wide rollup used by the BIR settings page. Returns each
 * reservation tagged with its derived status (live blocks past expiry
 * are flagged "expired" without the cron sweep needed) and the unused-
 * tail count an auditor would ask about.
 */
export const tenantReservationRollup = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const now = Date.now();

    const summary: Array<{
      locationId: Id<"locations">;
      locationName: string;
      reservations: Array<{
        _id: Id<"orderSerialReservations">;
        deviceId: string;
        prefix: string;
        fromSerial: number;
        toSerial: number;
        usedThrough: number;
        unusedTail: number;
        status: "active" | "exhausted" | "expired";
        expiresAt: number;
        createdAt: number;
      }>;
      totals: {
        active: number;
        exhausted: number;
        expired: number;
        unusedToReport: number; // serials in expired blocks past usedThrough
      };
    }> = [];

    for (const loc of locations) {
      const rows = await ctx.db
        .query("orderSerialReservations")
        .withIndex("by_location_status", (q) =>
          q.eq("locationId", loc._id)
        )
        .collect();
      rows.sort((a, b) => b._creationTime - a._creationTime);

      const reservations = rows.map((r) => {
        const derivedStatus: "active" | "exhausted" | "expired" =
          r.status === "exhausted"
            ? "exhausted"
            : r.expiresAt < now
              ? "expired"
              : "active";
        const unusedTail = Math.max(0, r.toSerial - r.usedThrough);
        return {
          _id: r._id,
          deviceId: r.deviceId,
          prefix: r.prefix,
          fromSerial: r.fromSerial,
          toSerial: r.toSerial,
          usedThrough: r.usedThrough,
          unusedTail,
          status: derivedStatus,
          expiresAt: r.expiresAt,
          createdAt: r._creationTime,
        };
      });

      const totals = reservations.reduce(
        (acc, r) => {
          acc[r.status]++;
          if (r.status === "expired") acc.unusedToReport += r.unusedTail;
          return acc;
        },
        { active: 0, exhausted: 0, expired: 0, unusedToReport: 0 }
      );

      summary.push({
        locationId: loc._id,
        locationName: loc.name,
        reservations,
        totals,
      });
    }

    return summary;
  },
});

/**
 * Validate + consume one pre-allocated serial during completeOrder.
 * Returns the formatted serial string, or throws if the reservation is
 * gone, expired, owned by a different device, or the offered serial is
 * out of range / already used. The caller (completeOrder) catches and
 * decides whether to fall back to fresh issuance.
 */
export async function consumePreallocatedSerial(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: { get: any; patch: any } } & Record<string, any>,
  reservationId: Id<"orderSerialReservations">,
  serialNumber: number,
  expectedDeviceId: string | undefined
): Promise<string> {
  const reservation = (await ctx.db.get(
    reservationId
  )) as Doc<"orderSerialReservations"> | null;
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "active") {
    throw new Error(`Reservation is ${reservation.status}`);
  }
  if (reservation.expiresAt < Date.now()) {
    await ctx.db.patch(reservationId, {
      status: "expired",
      updatedAt: Date.now(),
    });
    throw new Error("Reservation expired");
  }
  if (
    expectedDeviceId !== undefined &&
    expectedDeviceId !== reservation.deviceId
  ) {
    throw new Error("Reservation owned by a different device");
  }
  if (
    serialNumber < reservation.fromSerial ||
    serialNumber > reservation.toSerial
  ) {
    throw new Error("Serial out of reservation range");
  }
  if (serialNumber <= reservation.usedThrough) {
    throw new Error("Serial already consumed");
  }

  const exhausted = serialNumber >= reservation.toSerial;
  await ctx.db.patch(reservationId, {
    usedThrough: serialNumber,
    status: exhausted ? ("exhausted" as const) : ("active" as const),
    updatedAt: Date.now(),
  });

  return `${reservation.prefix}${String(serialNumber).padStart(8, "0")}`;
}
