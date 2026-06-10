"use client";

import { useState, useMemo } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import {
  addItemToDraft,
  applyDraftDiscount,
  clearDraft,
  computeDraftTotals,
  removeLine,
  updateLineQuantity,
  useLocalDraft,
} from "@/lib/offline/local-draft";
import { MenuGrid } from "@/components/register/menu-grid";
import { ModifierPanel } from "@/components/register/modifier-panel";
import { OfflineCheckoutDialog } from "./offline-checkout-dialog";
import { LocalReceiptView, type LocalReceiptData } from "./local-receipt-view";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";

type LocationItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  categoryId: Id<"categories">;
  basePrice: number;
  effectivePrice: number;
  hasOverride: boolean;
  isFeatured: boolean;
  imageUrl?: string | null;
  sku?: string;
  hasModifierGroups: boolean;
};

type Category = {
  _id: Id<"categories">;
  name: string;
  status: string;
  sortOrder: number;
};

type ModifierGroup = {
  _id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: Array<{
    _id: string;
    name: string;
    priceAdjustment: number;
    status: string;
    sortOrder: number;
    isDefault?: boolean;
    priceOverrides?: Array<{ variantKey: string; priceAdjustment: number }>;
  }>;
};

type BirSettingsShape = {
  tenant: {
    businessName: string | null;
    tradeName: string | null;
    businessAddress: string | null;
    tin: string | null;
    vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
    accreditedSupplierName: string | null;
    accreditedSupplierAccreditation: string | null;
    accreditedSupplierDateIssued: number | null;
    accreditedSupplierDateValid: number | null;
  };
  locations: Array<{
    _id: Id<"locations">;
    name: string;
    slug: string;
    birPermitNumber: string | null;
    birMin: string | null;
    birAtpNumber: string | null;
    birSerialPrefix: string | null;
    birSerialStart: number | null;
  }>;
};

type Props = {
  token: string;
  tenantId: Id<"tenants">;
  locationId: Id<"locations">;
  taxRateBps: number;
  onCompleted: (orderNumber: string) => void;
};

/**
 * Offline Quick Sale — the surface the cashier uses when the device
 * is disconnected at order-start. Reads the menu and modifier groups
 * from IndexedDB (cached during the last online session) so it works
 * with no network at all. Writes to the local-draft store, then queues
 * a single `submitOfflineOrder` mutation at checkout.
 *
 * Conscious omissions vs. the rich register:
 *   - No table assignment (offline orders are walk-in by default)
 *   - No customer lookup (loyalty stamp applies on replay if a customer
 *     id was attached; we don't search the customer DB while offline)
 *   - No fixed-amount or arbitrary percentage discounts. Sr/PWD is
 *     supported because it's BIR-mandated.
 */
export function OfflineQuickSale({
  token,
  tenantId,
  locationId,
  taxRateBps,
  onCompleted,
}: Props) {
  const items = useCachedQuery<LocationItem[]>(
    api.menu.queries.listItemsForLocation,
    { token, locationId },
    `menu:items:${tenantId}:${locationId}`
  );
  const categories = useCachedQuery<Category[]>(
    api.menu.queries.listCategories,
    { token },
    `menu:categories:${tenantId}`
  );
  const modifierMap = useCachedQuery<Record<string, ModifierGroup[]>>(
    api.menu.modifierQueries.bulkItemModifierGroups,
    { token, locationId },
    `menu:modifierGroups:${tenantId}:${locationId}`
  );
  // Cache BIR identity so the offline receipt can reproduce the same
  // BIR-compliant header during a network outage.
  const birSettings = useCachedQuery<BirSettingsShape>(
    api.settings.bir.getBirSettings,
    { token },
    `bir:settings:${tenantId}`
  );

  const draft = useLocalDraft(locationId);
  const { session } = useAuth();
  const convex = useConvex();
  void convex;
  const [receipt, setReceipt] = useState<LocalReceiptData | null>(null);

  const [pendingModifierItem, setPendingModifierItem] =
    useState<LocationItem | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [srPwdMode, setSrPwdMode] = useState(false);
  const [srPwdName, setSrPwdName] = useState("");
  const [srPwdId, setSrPwdId] = useState("");
  const [srPwdType, setSrPwdType] = useState<"senior" | "pwd">("senior");

  const totals = useMemo(
    () => (draft ? computeDraftTotals(draft, taxRateBps) : null),
    [draft, taxRateBps]
  );

  const handleItemTap = async (item: LocationItem) => {
    const groups = modifierMap?.[String(item._id)] ?? [];
    if (groups.length > 0) {
      setPendingModifierItem(item);
      return;
    }
    await addItemToDraft(locationId, {
      menuItemId: item._id,
      itemName: item.name,
      basePrice: item.effectivePrice,
      quantity: 1,
      modifiers: [],
    });
  };

  const handleCustomizeTap = (item: LocationItem) => {
    setPendingModifierItem(item);
  };

  const handleModifierConfirm = async (payload: {
    modifiers: Array<{ modifierName: string; priceAdjustment: number }>;
  }) => {
    if (!pendingModifierItem) return;
    await addItemToDraft(locationId, {
      menuItemId: pendingModifierItem._id,
      itemName: pendingModifierItem.name,
      basePrice: pendingModifierItem.effectivePrice,
      quantity: 1,
      modifiers: payload.modifiers,
    });
    setPendingModifierItem(null);
  };

  const handleApplySrPwd = async () => {
    if (!srPwdName.trim() || srPwdId.trim().length < 4) return;
    await applyDraftDiscount(locationId, {
      type: "percentage",
      value: 20,
      reason: srPwdType === "senior" ? "Senior Citizen" : "PWD",
      srPwdType,
      srPwdName: srPwdName.trim(),
      srPwdId: srPwdId.trim(),
    });
    setSrPwdMode(false);
  };

  const handleRemoveSrPwd = async () => {
    await applyDraftDiscount(locationId, undefined);
  };

  const handleCheckoutComplete = async (
    result: import("./offline-checkout-dialog").OfflineCheckoutResult
  ) => {
    if (!draft || !totals) {
      setShowCheckout(false);
      return;
    }
    // Snapshot the draft + cached BIR into a self-contained receipt
    // before the local draft is cleared. The receipt outlives the draft
    // because the cashier needs to print + close before we forget it.
    const locBir = birSettings?.locations.find((l) => l._id === locationId);
    const snapshot: LocalReceiptData = {
      birSerial: result.claimedSerial,
      fallbackNumber: result.orderNumber,
      completedAt: result.completedAt,
      baristaName: session?.userName ?? "Cashier",
      locationName: locBir?.name ?? "—",
      locationAddress:
        birSettings?.tenant.businessAddress ?? "",
      paymentType: result.paymentType,
      payments: result.payments,
      items: draft.items.map((line) => ({
        name: line.itemName,
        quantity: line.quantity,
        basePrice: line.basePrice,
        modifiers: line.modifiers.map((m) => ({
          name: m.modifierName,
          priceAdj: m.priceAdjustment,
        })),
      })),
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      taxRate: taxRateBps,
      taxLabel: birSettings?.tenant.vatStatus === "non_vat" ? "PT" : "VAT",
      total: totals.total,
      discountAmount: totals.discount,
      discountReason: draft.discount?.reason ?? null,
      vatableSales: totals.vatableSales,
      vatExemptSales: totals.vatExemptSales,
      zeroRatedSales: 0,
      bir: {
        businessName: birSettings?.tenant.businessName ?? null,
        tradeName: birSettings?.tenant.tradeName ?? null,
        businessAddress: birSettings?.tenant.businessAddress ?? null,
        tin: birSettings?.tenant.tin ?? null,
        vatStatus: birSettings?.tenant.vatStatus ?? null,
        accreditedSupplierName:
          birSettings?.tenant.accreditedSupplierName ?? null,
        accreditedSupplierAccreditation:
          birSettings?.tenant.accreditedSupplierAccreditation ?? null,
        ptu: locBir?.birPermitNumber ?? null,
        min: locBir?.birMin ?? null,
        atp: locBir?.birAtpNumber ?? null,
        srPwdType: draft.discount?.srPwdType ?? null,
        srPwdName: draft.discount?.srPwdName ?? null,
        srPwdId: draft.discount?.srPwdId ?? null,
      },
    };
    await clearDraft(locationId);
    setShowCheckout(false);
    setReceipt(snapshot);
  };

  const handleReceiptClose = () => {
    if (!receipt) return;
    const orderNumber = receipt.birSerial ?? receipt.fallbackNumber;
    setReceipt(null);
    onCompleted(orderNumber);
  };

  const ready = items !== undefined && categories !== undefined;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 h-full">
      {/* Menu grid */}
      <div className="min-w-0">
        {!ready ? (
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Loading cached menu…
          </p>
        ) : (
          <MenuGrid
            categories={categories ?? []}
            items={items ?? []}
            onItemTap={handleItemTap}
            onCustomizeTap={handleCustomizeTap}
          />
        )}
      </div>

      {/* Cart panel */}
      <div
        className="rounded-3xl p-4 flex flex-col h-full"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-fg)" }}
          >
            Offline Cart
          </h2>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(239,68,68,0.12)",
              color: "#b91c1c",
            }}
          >
            Local Draft
          </span>
        </div>

        {!draft || draft.items.length === 0 ? (
          <p
            className="text-xs flex-1 flex items-center justify-center"
            style={{ color: "var(--muted-fg)" }}
          >
            Tap an item to start the order.
          </p>
        ) : (
          <ul className="flex-1 overflow-y-auto space-y-1.5 mb-3">
            {draft.items.map((line) => {
              const modSum = line.modifiers.reduce(
                (s, m) => s + m.priceAdjustment,
                0
              );
              const lineTotal = (line.basePrice + modSum) * line.quantity;
              return (
                <li
                  key={line.lineId}
                  className="rounded-2xl p-2.5"
                  style={{
                    backgroundColor: "var(--muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className="text-sm font-semibold flex-1 truncate"
                      style={{ color: "var(--fg)" }}
                    >
                      {line.itemName}
                    </p>
                    <p
                      className="text-sm font-mono font-semibold"
                      style={{ color: "var(--fg)" }}
                    >
                      {formatCurrency(lineTotal)}
                    </p>
                  </div>
                  {line.modifiers.length > 0 && (
                    <p
                      className="text-[10px] mb-1.5"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {line.modifiers.map((m) => m.modifierName).join(" · ")}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateLineQuantity(
                          locationId,
                          line.lineId,
                          Math.max(0, line.quantity - 1)
                        )
                      }
                      className="w-7 h-7 rounded-full font-bold text-sm"
                      style={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border-color)",
                        color: "var(--fg)",
                      }}
                    >
                      −
                    </button>
                    <span
                      className="text-sm font-bold font-mono min-w-6 text-center"
                      style={{ color: "var(--fg)" }}
                    >
                      {line.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateLineQuantity(
                          locationId,
                          line.lineId,
                          line.quantity + 1
                        )
                      }
                      className="w-7 h-7 rounded-full font-bold text-sm"
                      style={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border-color)",
                        color: "var(--fg)",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeLine(locationId, line.lineId)}
                      className="ml-auto text-[11px] font-semibold"
                      style={{ color: "#ef4444" }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Sr/PWD section */}
        {draft && draft.items.length > 0 && (
          <div
            className="mb-3 rounded-2xl p-2.5"
            style={{
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border-color)",
            }}
          >
            {draft.discount?.srPwdType ? (
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--fg)" }}
                  >
                    {draft.discount.srPwdType === "senior" ? "Senior" : "PWD"}{" "}
                    discount applied
                  </p>
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {draft.discount.srPwdName} · {draft.discount.srPwdId}
                  </p>
                </div>
                <button
                  onClick={handleRemoveSrPwd}
                  className="text-[10px] font-semibold"
                  style={{ color: "#ef4444" }}
                >
                  Remove
                </button>
              </div>
            ) : srPwdMode ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {(["senior", "pwd"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSrPwdType(t)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest"
                      style={{
                        backgroundColor:
                          srPwdType === t ? "var(--accent-color)" : "var(--card)",
                        color: srPwdType === t ? "white" : "var(--muted-fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={srPwdName}
                  onChange={(e) => setSrPwdName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--fg)",
                    border: "1px solid var(--border-color)",
                  }}
                />
                <input
                  type="text"
                  value={srPwdId}
                  onChange={(e) => setSrPwdId(e.target.value)}
                  placeholder={srPwdType === "senior" ? "OSCA ID" : "PWD ID"}
                  className="w-full rounded-xl px-2 py-1.5 text-xs font-mono focus:outline-none"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--fg)",
                    border: "1px solid var(--border-color)",
                  }}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => setSrPwdMode(false)}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold"
                    style={{
                      backgroundColor: "var(--card)",
                      color: "var(--muted-fg)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplySrPwd}
                    disabled={
                      !srPwdName.trim() || srPwdId.trim().length < 4
                    }
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-40"
                    style={{
                      backgroundColor: "var(--accent-color)",
                      color: "white",
                    }}
                  >
                    Apply 20%
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSrPwdMode(true)}
                className="w-full text-[11px] font-semibold py-1"
                style={{ color: "var(--accent-color)" }}
              >
                + Senior / PWD discount
              </button>
            )}
          </div>
        )}

        {/* Totals + checkout */}
        {totals && draft && draft.items.length > 0 && (
          <div
            className="rounded-2xl p-3 space-y-1"
            style={{
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border-color)",
            }}
          >
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.discount > 0 && (
              <Row label="Discount" value={-totals.discount} tone="muted" />
            )}
            {totals.taxAmount > 0 && (
              <Row label="VAT" value={totals.taxAmount} tone="muted" />
            )}
            <div
              className="border-t pt-1.5 mt-1"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Row label="Total" value={totals.total} bold />
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-3 rounded-2xl text-sm font-bold mt-2"
              style={{ backgroundColor: "var(--accent-color)", color: "white" }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* Modifier panel */}
      {pendingModifierItem && (
        <ModifierPanel
          menuItemId={pendingModifierItem._id}
          itemName={pendingModifierItem.name}
          effectivePrice={pendingModifierItem.effectivePrice}
          onConfirm={handleModifierConfirm}
          onCancel={() => setPendingModifierItem(null)}
          token={token}
          groupsOverride={
            modifierMap?.[String(pendingModifierItem._id)] ?? []
          }
        />
      )}

      {/* Checkout dialog */}
      {showCheckout && draft && totals && (
        <OfflineCheckoutDialog
          draft={draft}
          totals={totals}
          locationId={locationId}
          taxRateBps={taxRateBps}
          onClose={() => setShowCheckout(false)}
          onCompleted={handleCheckoutComplete}
        />
      )}

      {/* Receipt — printed locally from the snapshot, so the customer
          walks out with a BIR-compliant copy even though the order
          hasn't reached the server yet. */}
      {receipt && (
        <LocalReceiptView receipt={receipt} onClose={handleReceiptClose} />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone = "fg",
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: "fg" | "muted";
}) {
  return (
    <div className="flex justify-between text-xs">
      <span
        style={{
          color: tone === "muted" ? "var(--muted-fg)" : "var(--fg)",
        }}
      >
        {label}
      </span>
      <span
        className={`font-mono ${bold ? "font-bold text-sm" : ""}`}
        style={{ color: "var(--fg)" }}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
