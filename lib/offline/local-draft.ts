"use client";

import { cache } from "./db";
import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Local-only order draft for cold-start offline mode. Lives entirely in
 * IndexedDB so a brownout mid-cart doesn't lose the order. One active
 * draft per location at a time — matches the live flow's single-draft
 * model (the existing `getCurrentDraft` query is also one-per-location).
 *
 * When the cashier rings up, we collect everything in this draft into a
 * single `submitOfflineOrder` payload, claim a pre-allocated BIR serial,
 * and hand the result to the offline queue. The draft is then cleared
 * locally — the server-side order document becomes the source of truth
 * once replay succeeds.
 *
 * Key: `local-draft:<locationId>`.
 */

export type LocalDraftItem = {
  /** Stable per-line client id so qty changes can target the right row. */
  lineId: string;
  menuItemId: Id<"menuItems">;
  itemName: string;
  basePrice: number; // cents, snapshot at add-time
  quantity: number;
  modifiers: Array<{ modifierName: string; priceAdjustment: number }>;
  customerLabel?: string;
};

export type LocalDraft = {
  clientOrderId: string;
  locationId: Id<"locations">;
  tableId?: Id<"tables">;
  tableName?: string;
  customerId?: Id<"customers">;
  customerLabel?: string;
  items: LocalDraftItem[];
  discount?: {
    type: "percentage" | "fixed";
    value: number;
    amount?: number;
    reason: string;
    srPwdType?: "senior" | "pwd";
    srPwdName?: string;
    srPwdId?: string;
  };
  createdAt: number;
  updatedAt: number;
};

const KEY = (locationId: string) => `local-draft:${locationId}`;

const subscribers = new Map<string, Set<(d: LocalDraft | null) => void>>();

function notify(locationId: string, draft: LocalDraft | null): void {
  const subs = subscribers.get(locationId);
  if (subs) for (const fn of subs) fn(draft);
}

/**
 * Subscribe to live changes on a local draft. Used by `useLocalDraft`
 * inside the offline UI so the cart updates immediately after an addItem
 * without waiting for an IDB roundtrip on every render.
 */
export function subscribeLocalDraft(
  locationId: string,
  fn: (d: LocalDraft | null) => void
): () => void {
  let subs = subscribers.get(locationId);
  if (!subs) {
    subs = new Set();
    subscribers.set(locationId, subs);
  }
  subs.add(fn);
  void getLocalDraft(locationId as Id<"locations">).then(fn);
  return () => {
    subs!.delete(fn);
  };
}

export async function getLocalDraft(
  locationId: Id<"locations">
): Promise<LocalDraft | null> {
  return cache.get<LocalDraft>(KEY(locationId));
}

async function writeDraft(draft: LocalDraft): Promise<void> {
  await cache.set(KEY(draft.locationId), draft);
  notify(draft.locationId, draft);
}

async function deleteDraft(locationId: Id<"locations">): Promise<void> {
  await cache.delete(KEY(locationId));
  notify(locationId, null);
}

export async function startDraft(
  locationId: Id<"locations">,
  opts: { tableId?: Id<"tables">; tableName?: string } = {}
): Promise<LocalDraft> {
  const draft: LocalDraft = {
    clientOrderId: crypto.randomUUID(),
    locationId,
    tableId: opts.tableId,
    tableName: opts.tableName,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await writeDraft(draft);
  return draft;
}

export async function addItemToDraft(
  locationId: Id<"locations">,
  item: Omit<LocalDraftItem, "lineId">
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  const target =
    draft ??
    (await startDraft(locationId));
  const lineId = crypto.randomUUID();
  target.items = [...target.items, { ...item, lineId }];
  target.updatedAt = Date.now();
  await writeDraft(target);
}

export async function updateLineQuantity(
  locationId: Id<"locations">,
  lineId: string,
  qty: number
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  if (!draft) return;
  draft.items = draft.items
    .map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l))
    .filter((l) => l.quantity > 0);
  draft.updatedAt = Date.now();
  if (draft.items.length === 0) {
    // Drop empty drafts so the UI auto-resets to the menu state.
    await deleteDraft(locationId);
    return;
  }
  await writeDraft(draft);
}

export async function removeLine(
  locationId: Id<"locations">,
  lineId: string
): Promise<void> {
  await updateLineQuantity(locationId, lineId, 0);
}

export async function setLineLabel(
  locationId: Id<"locations">,
  lineId: string,
  label: string | undefined
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  if (!draft) return;
  draft.items = draft.items.map((l) =>
    l.lineId === lineId ? { ...l, customerLabel: label } : l
  );
  draft.updatedAt = Date.now();
  await writeDraft(draft);
}

export async function setDraftLabel(
  locationId: Id<"locations">,
  label: string | undefined
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  if (!draft) return;
  draft.customerLabel = label;
  draft.updatedAt = Date.now();
  await writeDraft(draft);
}

export async function setDraftCustomer(
  locationId: Id<"locations">,
  customer: { customerId?: Id<"customers">; customerLabel?: string }
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  if (!draft) return;
  draft.customerId = customer.customerId;
  if (customer.customerLabel !== undefined)
    draft.customerLabel = customer.customerLabel;
  draft.updatedAt = Date.now();
  await writeDraft(draft);
}

export async function applyDraftDiscount(
  locationId: Id<"locations">,
  discount: LocalDraft["discount"] | undefined
): Promise<void> {
  const draft = await getLocalDraft(locationId);
  if (!draft) return;
  draft.discount = discount;
  draft.updatedAt = Date.now();
  await writeDraft(draft);
}

export async function clearDraft(
  locationId: Id<"locations">
): Promise<void> {
  await deleteDraft(locationId);
}

/**
 * Compute the same totals submitOfflineOrder will compute on the server.
 * Used by the offline UI to show the cashier exactly what the customer
 * will pay BEFORE we queue the order. The server re-derives these from
 * scratch to defend against tampered clients, but the math here must
 * match so the displayed total isn't a lie.
 */
export function computeDraftTotals(
  draft: LocalDraft,
  taxRateBps: number
): {
  subtotal: number;
  discount: number;
  vatableSales: number;
  vatExemptSales: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = draft.items.reduce((sum, line) => {
    const modSum = line.modifiers.reduce((s, m) => s + m.priceAdjustment, 0);
    return sum + (line.basePrice + modSum) * line.quantity;
  }, 0);

  // Discount path matches the server logic in submitOfflineOrder /
  // completeOrder. Sr/PWD strips VAT and applies 20% to the net of VAT.
  let discountAmount = draft.discount?.amount ?? 0;
  const isSrPwd = !!draft.discount?.srPwdType;
  if (
    draft.discount?.type === "percentage" &&
    draft.discount.value &&
    !isSrPwd
  ) {
    discountAmount = Math.round((subtotal * draft.discount.value) / 100);
  }
  if (discountAmount > subtotal) discountAmount = subtotal;

  if (isSrPwd) {
    const netOfVat = Math.round((subtotal * 100) / 112);
    const srPwdDiscount = Math.round(netOfVat * 0.2);
    return {
      subtotal,
      discount: srPwdDiscount,
      vatableSales: 0,
      vatExemptSales: netOfVat - srPwdDiscount,
      taxAmount: 0,
      total: netOfVat - srPwdDiscount,
    };
  }

  const taxAmount = Math.round(
    (subtotal - discountAmount) * (taxRateBps / 10000)
  );
  return {
    subtotal,
    discount: discountAmount,
    vatableSales: subtotal - discountAmount,
    vatExemptSales: 0,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
  };
}

/** React hook — subscribe to a location's local draft. */
export function useLocalDraft(
  locationId: Id<"locations"> | undefined
): LocalDraft | null {
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  useEffect(() => {
    if (!locationId) {
      setDraft(null);
      return;
    }
    return subscribeLocalDraft(locationId, setDraft);
  }, [locationId]);
  return draft;
}
