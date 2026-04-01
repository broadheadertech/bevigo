"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { LoyaltyCard } from "@/components/customers/loyalty-card";

type FoundCustomer = {
  _id: Id<"customers">;
  name: string;
  phone?: string;
  email?: string;
  visitCount: number;
  totalSpent: number;
  loyaltyStamps: number;
  loyaltyRequired: number;
  loyaltyCardFull: boolean;
};

type CustomerLookupProps = {
  onLink: (customerId: Id<"customers">) => void;
  onClose: () => void;
};

export function CustomerLookup({ onLink, onClose }: CustomerLookupProps) {
  const { token } = useAuth();
  const [phone, setPhone] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const foundCustomer = useQuery(
    api.customers.queries.findByPhone,
    token && phone.length >= 4 ? { token, phone } : "skip"
  ) as FoundCustomer | null | undefined;

  const quickCreate = useMutation(api.customers.mutations.quickCreate);

  const handleLink = useCallback(
    (customerId: Id<"customers">) => {
      onLink(customerId);
    },
    [onLink]
  );

  const handleQuickCreate = useCallback(async () => {
    if (!token || !newName.trim()) return;
    try {
      const customerId = await quickCreate({
        token,
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      });
      onLink(customerId);
    } catch (err) {
      console.error("Failed to create customer:", err);
      alert(err instanceof Error ? err.message : "Failed to create customer");
    }
  }, [token, newName, newPhone, quickCreate, onLink]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-700">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Link Customer</h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          {!showNewForm ? (
            <>
              {/* Phone lookup */}
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Customer Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />

              {/* Result */}
              {phone.length >= 4 && foundCustomer === null && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                    No customer found with that number
                  </p>
                  <button
                    onClick={() => {
                      setShowNewForm(true);
                      setNewPhone(phone);
                    }}
                    className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
                  >
                    + New Customer
                  </button>
                </div>
              )}

              {foundCustomer && (
                <div className="mt-4 p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">
                        {foundCustomer.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {foundCustomer.visitCount} visits |{" "}
                        {foundCustomer.phone}
                      </p>
                    </div>
                  </div>

                  <LoyaltyCard
                    stampsEarned={foundCustomer.loyaltyStamps}
                    stampsRequired={foundCustomer.loyaltyRequired}
                    compact
                  />

                  <button
                    onClick={() => handleLink(foundCustomer._id)}
                    className="w-full mt-3 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
                  >
                    Link to Order
                  </button>
                </div>
              )}

              {/* Quick link to new customer form */}
              {phone.length < 4 && (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full mt-4 py-2.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  + New Customer
                </button>
              )}
            </>
          ) : (
            <>
              {/* Quick-add form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Customer name"
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleQuickCreate}
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors"
                >
                  Create & Link
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2.5 text-sm text-stone-600 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
