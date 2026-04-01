"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback, useRef } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { MenuGrid } from "@/components/register/menu-grid";
import { OrderPanel } from "@/components/register/order-panel";
import { PendingOrders } from "@/components/register/pending-orders";
import { ModifierPanel } from "@/components/register/modifier-panel";
import { PaymentDialog } from "@/components/register/payment-dialog";
import { OrderCompleteToast } from "@/components/register/order-complete-toast";
import { ReceiptView } from "@/components/register/receipt-view";
import { ShortcutHelp } from "@/components/register/shortcut-help";
import { useRegisterShortcuts } from "@/hooks/use-register-shortcuts";
import { ShiftIndicator } from "@/components/shifts/shift-indicator";
import { useAutoPrint, usePrinterConnected } from "@/components/register/printer-settings";
import { receiptPrinter } from "@/lib/receipt-printer";
import type { ReceiptData } from "@/lib/receipt-printer";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { CustomerLookup } from "@/components/register/customer-lookup";
import { LoyaltyCard } from "@/components/customers/loyalty-card";
import { TableSelector } from "@/components/register/table-selector";

// Module-level variable to track last auto-printed order (avoids ref assignment during render)
let lastPrintedOrderId: string | null = null;

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
};

export default function RegisterPage() {
  const { session, token } = useAuth();

  // For now, use the first assigned location
  const locationIds = session?.locationIds as Id<"locations">[] | undefined;
  const locationId = locationIds?.[0];

  const items = useQuery(
    api.menu.queries.listItemsForLocation,
    token && locationId ? { token, locationId } : "skip"
  ) as LocationItem[] | undefined;

  const categories = useQuery(
    api.menu.queries.listCategories,
    token ? { token } : "skip"
  );

  const currentDraft = useQuery(
    api.orders.queries.getCurrentDraft,
    token && locationId ? { token, locationId } : "skip"
  );

  const activeShift = useQuery(
    api.shifts.queries.getActiveShift,
    token && locationId ? { token, locationId } : "skip"
  ) as { _id: string; startedAt: number } | null | undefined;

  const createDraft = useMutation(api.orders.mutations.createDraftOrder);
  const addItem = useMutation(api.orders.mutations.addItemToOrder);
  const addItemWithModifiers = useMutation(api.orders.mutations.addItemWithModifiers);
  const removeItem = useMutation(api.orders.mutations.removeItemFromOrder);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<Id<"orders"> | null>(null);
  const [selectedItemForModifiers, setSelectedItemForModifiers] =
    useState<LocationItem | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<Id<"orders"> | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const scanToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<Id<"tables"> | null>(null);

  // Printer state
  const autoPrint = useAutoPrint();
  const printerConnected = usePrinterConnected();

  // Receipt data for auto-print (fetched after completion)
  const receiptForPrint = useQuery(
    api.orders.queries.getReceipt,
    token && completedOrderId ? { token, orderId: completedOrderId } : "skip"
  ) as {
    orderNumber: string;
    completedAt: number;
    locationName: string;
    locationAddress: string;
    baristaName: string;
    paymentType: string;
    items: Array<{ name: string; quantity: number; subtotal: number; modifiers: Array<{ name: string; priceAdj: number }> }>;
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    taxLabel: string;
    total: number;
  } | null | undefined;

  // Auto-print when receipt data arrives and auto-print is enabled
  if (
    autoPrint &&
    printerConnected &&
    receiptForPrint &&
    completedOrderId &&
    lastPrintedOrderId !== completedOrderId
  ) {
    lastPrintedOrderId = completedOrderId;
    const printData: ReceiptData = {
      shopName: receiptForPrint.locationName,
      address: receiptForPrint.locationAddress,
      orderNumber: receiptForPrint.orderNumber,
      date: new Date(receiptForPrint.completedAt).toLocaleString(),
      cashierName: receiptForPrint.baristaName,
      items: receiptForPrint.items.map((item: { name: string; quantity: number; subtotal: number; modifiers: Array<{ name: string; priceAdj: number }> }) => ({
        name: item.name,
        quantity: item.quantity,
        subtotal: item.subtotal,
        modifiers: item.modifiers,
      })),
      subtotal: receiptForPrint.subtotal,
      taxLabel: receiptForPrint.taxLabel,
      taxRate: receiptForPrint.taxRate,
      taxAmount: receiptForPrint.taxAmount,
      total: receiptForPrint.total,
      paymentType: receiptForPrint.paymentType,
    };
    const openDrawer = receiptForPrint.paymentType === "Cash" || receiptForPrint.paymentType === "cash";
    receiptPrinter.printReceipt(printData, openDrawer).catch((err: unknown) => {
      console.error("Auto-print failed:", err);
    });
  }

  const pendingOrders = useQuery(
    api.orders.queries.listPending,
    token && locationId ? { token, locationId } : "skip"
  ) as Array<{
    _id: Id<"orders">;
    userId: Id<"users">;
    subtotal: number;
    itemCount: number;
    _creationTime: number;
  }> | undefined;

  // When switching orders, fetch the selected order details
  const selectedOrder = useQuery(
    api.orders.queries.getOrderWithItems,
    token && activeOrderId ? { token, orderId: activeOrderId } : "skip"
  );

  // Determine which order to display: selected order or current draft
  const displayOrder = activeOrderId ? selectedOrder : currentDraft;

  const ensureDraftOrder = useCallback(async (): Promise<Id<"orders"> | null> => {
    if (!token || !locationId) return null;

    // If we have an active order selected, use it
    if (activeOrderId) return activeOrderId;

    // If we already have a draft, use it
    if (currentDraft?._id) return currentDraft._id;

    // Create a new draft, optionally with a table
    const orderId = await createDraft({
      token,
      locationId,
      tableId: selectedTableId ?? undefined,
    });
    return orderId;
  }, [token, locationId, activeOrderId, currentDraft, createDraft, selectedTableId]);

  // Table assignment
  const assignTable = useMutation(api.orders.mutations.assignTableToOrder);

  const handleTableSelect = useCallback(
    async (tableId: Id<"tables"> | null, occupiedOrderId?: Id<"orders">) => {
      if (occupiedOrderId) {
        // Switch to the occupied table's existing order
        setActiveOrderId(occupiedOrderId);
        setSelectedTableId(tableId);
        return;
      }

      setSelectedTableId(tableId);

      // If there's a current draft order, assign/unassign the table
      const orderId = displayOrder?._id;
      if (orderId && token) {
        try {
          await assignTable({
            token,
            orderId,
            tableId: tableId ?? undefined,
          });
        } catch (err) {
          console.error("Failed to assign table:", err);
        }
      }
    },
    [token, displayOrder, assignTable]
  );

  // Customer engagement
  const linkCustomer = useMutation(api.orders.mutations.linkCustomerToOrder);
  const unlinkCustomer = useMutation(api.orders.mutations.unlinkCustomerFromOrder);
  const redeemReward = useMutation(api.customers.mutations.redeemReward);

  // Get linked customer info for current order
  const linkedCustomerId = (displayOrder as Record<string, unknown> | null | undefined)?.customerId as Id<"customers"> | undefined;

  const linkedCustomer = useQuery(
    api.customers.queries.getCustomer,
    token && linkedCustomerId ? { token, customerId: linkedCustomerId } : "skip"
  ) as { _id: Id<"customers">; name: string; phone?: string; visitCount: number } | null | undefined;

  const linkedLoyaltyCard = useQuery(
    api.customers.queries.getLoyaltyCard,
    token && linkedCustomerId ? { token, customerId: linkedCustomerId } : "skip"
  ) as { _id: Id<"loyaltyCards">; stampsEarned: number; stampsRequired: number; status: string } | null | undefined;

  const handleLinkCustomer = useCallback(
    async (customerId: Id<"customers">) => {
      if (!token) return;
      try {
        const orderId = await ensureDraftOrder();
        if (!orderId) return;
        await linkCustomer({ token, orderId, customerId });
        setShowCustomerLookup(false);
      } catch (err) {
        console.error("Failed to link customer:", err);
      }
    },
    [token, ensureDraftOrder, linkCustomer]
  );

  const handleUnlinkCustomer = useCallback(async () => {
    if (!token || !displayOrder?._id) return;
    try {
      await unlinkCustomer({ token, orderId: displayOrder._id });
    } catch (err) {
      console.error("Failed to unlink customer:", err);
    }
  }, [token, displayOrder, unlinkCustomer]);

  const handleRedeemReward = useCallback(async () => {
    if (!token || !linkedCustomerId || !displayOrder?._id) return;
    try {
      await redeemReward({ token, customerId: linkedCustomerId, orderId: displayOrder._id });
    } catch (err) {
      console.error("Failed to redeem reward:", err);
    }
  }, [token, linkedCustomerId, displayOrder, redeemReward]);

  // Barcode scanner
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!token || !locationId) return;
      try {
        const match = items?.find((item: LocationItem) => item.sku === barcode);

        if (match) {
          // Auto-add to order
          const orderId = await ensureDraftOrder();
          if (orderId) {
            await addItem({ token, orderId, menuItemId: match._id });
            setScanToast(`Scanned: ${match.name}`);
            if (scanToastTimerRef.current) clearTimeout(scanToastTimerRef.current);
            scanToastTimerRef.current = setTimeout(() => setScanToast(null), 2500);
          }
        } else {
          setScanToast(`No item found for barcode: ${barcode}`);
          if (scanToastTimerRef.current) clearTimeout(scanToastTimerRef.current);
          scanToastTimerRef.current = setTimeout(() => setScanToast(null), 2500);
        }
      } catch (err) {
        console.error("Barcode scan error:", err);
      }
    },
    [token, locationId, items, ensureDraftOrder, addItem]
  );

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleItemTap = useCallback(
    (item: LocationItem) => {
      if (!token) return;
      // Open the modifier panel for every item tap.
      // The panel queries modifier groups for this item:
      // - If groups exist, user selects modifiers then confirms.
      // - If no groups exist, user sees "no modifiers" and taps "Add to Order" to add directly.
      setSelectedItemForModifiers(item);
    },
    [token]
  );

  const handleModifierConfirm = useCallback(
    async (payload: {
      modifiers: Array<{ modifierName: string; priceAdjustment: number }>;
    }) => {
      if (!token || !selectedItemForModifiers) return;
      setIsProcessing(true);
      try {
        const orderId = await ensureDraftOrder();
        if (!orderId) return;

        if (payload.modifiers.length === 0) {
          // No modifiers selected — use the simple addItem mutation
          await addItem({
            token,
            orderId,
            menuItemId: selectedItemForModifiers._id,
          });
        } else {
          await addItemWithModifiers({
            token,
            orderId,
            menuItemId: selectedItemForModifiers._id,
            modifiers: payload.modifiers,
          });
        }
      } catch (err) {
        console.error("Failed to add item:", err);
      } finally {
        setIsProcessing(false);
        setSelectedItemForModifiers(null);
      }
    },
    [token, ensureDraftOrder, addItem, addItemWithModifiers, selectedItemForModifiers]
  );

  const handleModifierCancel = useCallback(() => {
    setSelectedItemForModifiers(null);
  }, []);

  const handleRemoveItem = useCallback(
    async (orderItemId: Id<"orderItems">) => {
      if (!token) return;
      try {
        await removeItem({ token, orderItemId });
      } catch (err) {
        console.error("Failed to remove item:", err);
      }
    },
    [token, removeItem]
  );

  const handleEditItem = useCallback(
    (item: { _id: Id<"orderItems">; itemName: string }) => {
      // TODO: Wire up to modifier panel for editing existing order items
      console.log("Edit item modifiers:", item._id, item.itemName);
    },
    []
  );

  const handleSelectOrder = useCallback(
    (orderId: Id<"orders">) => {
      setActiveOrderId(orderId);
    },
    []
  );

  const handleNewOrder = useCallback(async () => {
    if (!token || !locationId) return;
    try {
      const orderId = await createDraft({
        token,
        locationId,
        tableId: selectedTableId ?? undefined,
      });
      setActiveOrderId(orderId);
    } catch (err) {
      console.error("Failed to create new order:", err);
    }
  }, [token, locationId, createDraft, selectedTableId]);

  const handleComplete = useCallback(() => {
    setShowPaymentDialog(true);
  }, []);

  const handlePaymentCompleted = useCallback((orderNumber: string) => {
    setShowPaymentDialog(false);
    setCompletedOrderNumber(orderNumber);
    setCompletedOrderId(displayOrder?._id ?? null);
    setActiveOrderId(null);
    setSelectedTableId(null);
  }, [displayOrder]);

  const handleDismissToast = useCallback(() => {
    setCompletedOrderNumber(null);
    setCompletedOrderId(null);
  }, []);

  const handleViewReceipt = useCallback(() => {
    setCompletedOrderNumber(null);
    setShowReceipt(true);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setShowReceipt(false);
    setCompletedOrderId(null);
  }, []);

  const handleVoidOrder = useCallback(() => {
    // Void = close active order and reset
    setActiveOrderId(null);
    setShowPaymentDialog(false);
    setSelectedItemForModifiers(null);
    setSelectedTableId(null);
  }, []);

  const handleCancelAction = useCallback(() => {
    if (showReceipt) {
      setShowReceipt(false);
      setCompletedOrderId(null);
    } else if (showPaymentDialog) {
      setShowPaymentDialog(false);
    } else if (selectedItemForModifiers) {
      setSelectedItemForModifiers(null);
    }
  }, [showReceipt, showPaymentDialog, selectedItemForModifiers]);

  useRegisterShortcuts({
    onCompleteOrder: handleComplete,
    onVoidOrder: handleVoidOrder,
    onCancelAction: handleCancelAction,
  });

  if (!token || !session || !locationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-stone-500 dark:text-stone-400">Loading register...</p>
      </div>
    );
  }

  // Require an active shift before taking orders
  if (activeShift === null) {
    return (
      <div className="flex flex-col h-full">
        <ShiftIndicator locationId={locationId} />
        <div className="flex-1 flex items-center justify-center bg-stone-100 dark:bg-stone-900">
          <div className="text-center max-w-sm px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">Start a Shift First</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
              You need to start a shift before taking orders. This tracks your opening cash and sales for the day.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Tap &quot;Start&quot; in the bar above to begin your shift.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const typedCategories = (categories ?? []) as Array<{
    _id: Id<"categories">;
    name: string;
    sortOrder: number;
    status: string;
  }>;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: shift indicator */}
      <ShiftIndicator locationId={locationId} />

      <div className="flex flex-1 min-h-0">
      {/* Left: Menu grid (~65%) */}
      <div className="flex-[65] overflow-hidden bg-stone-100 dark:bg-stone-950">
        <MenuGrid
          categories={typedCategories}
          items={items ?? []}
          onItemTap={handleItemTap}
        />
      </div>

      {/* Right: Order panel (~35%) */}
      <div className="flex-[35] flex flex-col">
        <PendingOrders
          orders={pendingOrders ?? []}
          activeOrderId={activeOrderId ?? (currentDraft?._id as Id<"orders"> | null) ?? null}
          onSelectOrder={handleSelectOrder}
          onNewOrder={handleNewOrder}
        />
        {/* Table selector */}
        <div className="px-3 py-1 border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card)" }}>
          <TableSelector
            token={token}
            locationId={locationId}
            selectedTableId={selectedTableId}
            onSelectTable={handleTableSelect}
          />
        </div>

        {/* Customer button + loyalty strip */}
        <div className="px-3 py-2 border-b border-stone-200 bg-white">
          {linkedCustomer ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-900 truncate">
                    {linkedCustomer.name}
                  </span>
                  <button
                    onClick={handleUnlinkCustomer}
                    className="text-xs text-stone-400 hover:text-red-500"
                    title="Remove customer"
                  >
                    x
                  </button>
                </div>
                {linkedLoyaltyCard && (
                  <div className="mt-1">
                    <LoyaltyCard
                      stampsEarned={linkedLoyaltyCard.stampsEarned}
                      stampsRequired={linkedLoyaltyCard.stampsRequired}
                      compact
                    />
                  </div>
                )}
              </div>
              {linkedLoyaltyCard &&
                linkedLoyaltyCard.stampsEarned >= linkedLoyaltyCard.stampsRequired && (
                  <button
                    onClick={handleRedeemReward}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    Redeem
                  </button>
                )}
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerLookup(true)}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Customer
            </button>
          )}
        </div>

        <OrderPanel
          order={displayOrder as Parameters<typeof OrderPanel>[0]["order"]}
          onRemoveItem={handleRemoveItem}
          onEditItem={handleEditItem}
          onComplete={handleComplete}
          isLoading={isProcessing}
        />
      </div>

      </div>

      {/* Shortcut help */}
      <ShortcutHelp />

      {/* Modifier panel overlay */}
      {selectedItemForModifiers && token && (
        <ModifierPanel
          menuItemId={selectedItemForModifiers._id}
          itemName={selectedItemForModifiers.name}
          effectivePrice={selectedItemForModifiers.effectivePrice}
          onConfirm={handleModifierConfirm}
          onCancel={handleModifierCancel}
          token={token}
        />
      )}

      {/* Payment dialog */}
      {showPaymentDialog && displayOrder && (
        <PaymentDialog
          orderId={displayOrder._id}
          orderTotal={displayOrder.total}
          onClose={() => setShowPaymentDialog(false)}
          onCompleted={handlePaymentCompleted}
        />
      )}

      {/* Order complete toast */}
      {completedOrderNumber && (
        <OrderCompleteToast
          orderNumber={completedOrderNumber}
          onDismiss={handleDismissToast}
          onViewReceipt={completedOrderId ? handleViewReceipt : undefined}
        />
      )}

      {/* Receipt view */}
      {showReceipt && completedOrderId && token && (
        <ReceiptView
          orderId={completedOrderId}
          token={token}
          onClose={handleCloseReceipt}
        />
      )}

      {/* Customer lookup modal */}
      {showCustomerLookup && (
        <CustomerLookup
          onLink={handleLinkCustomer}
          onClose={() => setShowCustomerLookup(false)}
        />
      )}

      {/* Barcode scan toast */}
      {scanToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-stone-900 text-white text-sm rounded-xl shadow-lg">
          {scanToast}
        </div>
      )}
    </div>
  );
}
