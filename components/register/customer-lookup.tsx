"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type Customer = {
  _id: Id<"customers">;
  customerNumber?: string;
  name: string;
  phone?: string;
  email?: string;
  visitCount: number;
  totalSpent: number;
  pointsBalance?: number;
};

type CustomerLookupProps = {
  onLink: (customerId: Id<"customers">) => void;
  onClose: () => void;
};

export function CustomerLookup({ onLink, onClose }: CustomerLookupProps) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Search all customers and filter client-side
  const allCustomers = useQuery(
    api.customers.queries.listCustomers,
    token ? { token } : "skip"
  ) as Customer[] | undefined;

  const quickCreate = useMutation(api.customers.mutations.quickCreate);

  // Filter by search term (name, phone, or customer number)
  const filtered = (allCustomers ?? []).filter((c: Customer) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.customerNumber && c.customerNumber.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }).slice(0, 10);

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
      alert(err instanceof Error ? err.message : "Failed to create customer");
    }
  }, [token, newName, newPhone, quickCreate, onLink]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Link Customer</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ color: "var(--muted-fg)" }}>
            &#10005;
          </button>
        </div>

        <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col">
          {!showNewForm ? (
            <>
              {/* Search input */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or ID..."
                autoFocus
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              />

              {/* Results */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {filtered.length > 0 ? (
                  filtered.map((c: Customer) => (
                    <button
                      key={c._id}
                      onClick={() => onLink(c._id)}
                      className="w-full text-left px-4 py-3 rounded-2xl transition-all duration-100 hover:scale-[1.01] active:scale-[0.99]"
                      style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{c.name}</span>
                            {c.customerNumber && (
                              <span className="text-[10px] font-mono font-semibold" style={{ color: "var(--accent-color)" }}>
                                {c.customerNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {c.phone && (
                              <span className="text-xs" style={{ color: "var(--muted-fg)" }}>{c.phone}</span>
                            )}
                            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                              {c.visitCount} visits
                            </span>
                            {(c.pointsBalance ?? 0) > 0 && (
                              <span className="text-xs font-semibold" style={{ color: "var(--accent-color)" }}>
                                {c.pointsBalance} pts
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                          {formatCurrency(c.totalSpent)}
                        </span>
                      </div>
                    </button>
                  ))
                ) : search.length > 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm mb-4" style={{ color: "var(--muted-fg)" }}>
                      No customer found for &quot;{search}&quot;
                    </p>
                    <button
                      onClick={() => {
                        setShowNewForm(true);
                        setNewName(search);
                      }}
                      className="px-4 py-2.5 text-sm font-semibold rounded-2xl transition-colors"
                      style={{ backgroundColor: "var(--accent-color)", color: "white" }}
                    >
                      + Create &quot;{search}&quot;
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                      Type to search customers
                    </p>
                  </div>
                )}
              </div>

              {/* New customer shortcut */}
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full mt-4 py-3 text-sm font-semibold rounded-2xl border border-dashed transition-colors"
                style={{ borderColor: "var(--border-color)", color: "var(--muted-fg)" }}
              >
                + New Customer
              </button>
            </>
          ) : (
            <>
              {/* Quick-add form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Customer name"
                    autoFocus
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleQuickCreate}
                  disabled={!newName.trim()}
                  className="flex-1 py-3 text-white text-sm font-bold rounded-2xl disabled:opacity-50 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Create & Link
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-5 py-3 text-sm font-medium rounded-2xl transition-colors"
                  style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
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
