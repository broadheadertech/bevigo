"use client";

import { useQuery, useMutation } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useCallback } from"react";
import { Id } from"../../../convex/_generated/dataModel";
import { formatCurrency } from"@/lib/currency";
import { LoyaltyCard } from"@/components/customers/loyalty-card";
import { Pagination, usePagination } from"@/components/ui/pagination";

type CustomerRow = {
 _id: Id<"customers">;
 name: string;
 phone?: string;
 email?: string;
 visitCount: number;
 totalSpent: number;
 lastVisitAt?: number;
 status:"active" |"inactive";
 loyaltyStamps: number;
 loyaltyRequired: number;
 loyaltyCardFull: boolean;
};

type CustomerOrder = {
 _id: Id<"orders">;
 orderNumber?: string;
 completedAt?: number;
 total: number;
 paymentType?: string;
 items: Array<{ itemName: string; quantity: number; subtotal: number }>;
};

type CustomerFavorite = {
 itemName: string;
 count: number;
};

export default function CustomersPage() {
 const { token } = useAuth();
 const [search, setSearch] = useState("");
 const [showAddForm, setShowAddForm] = useState(false);
 const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
 const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
 const [activeTab, setActiveTab] = useState<"details" |"orders" |"favorites">("details");

 // Form state
 const [formName, setFormName] = useState("");
 const [formPhone, setFormPhone] = useState("");
 const [formEmail, setFormEmail] = useState("");

 const customers = useQuery(
 api.customers.queries.listCustomers,
 token ? { token, search: search || undefined } :"skip"
 ) as CustomerRow[] | undefined;

 const selectedCustomer = useQuery(
 api.customers.queries.getCustomer,
 token && selectedCustomerId ? { token, customerId: selectedCustomerId } :"skip"
 );

 const loyaltyCard = useQuery(
 api.customers.queries.getLoyaltyCard,
 token && selectedCustomerId ? { token, customerId: selectedCustomerId } :"skip"
 );

 const customerOrders = useQuery(
 api.customers.queries.getCustomerOrders,
 token && selectedCustomerId ? { token, customerId: selectedCustomerId, limit: 20 } :"skip"
 ) as CustomerOrder[] | undefined;

 const customerFavorites = useQuery(
 api.customers.queries.getCustomerFavorites,
 token && selectedCustomerId ? { token, customerId: selectedCustomerId } :"skip"
 ) as CustomerFavorite[] | undefined;

 const createCustomer = useMutation(api.customers.mutations.createCustomer);
 const updateCustomer = useMutation(api.customers.mutations.updateCustomer);

 const handleAdd = useCallback(async () => {
 if (!token || !formName.trim()) return;
 try {
 await createCustomer({
 token,
 name: formName.trim(),
 phone: formPhone.trim() || undefined,
 email: formEmail.trim() || undefined,
 });
 setFormName("");
 setFormPhone("");
 setFormEmail("");
 setShowAddForm(false);
 } catch (err) {
 console.error("Failed to create customer:", err);
 alert(err instanceof Error ? err.message :"Failed to create customer");
 }
 }, [token, formName, formPhone, formEmail, createCustomer]);

 const handleUpdate = useCallback(async () => {
 if (!token || !editingCustomer) return;
 try {
 await updateCustomer({
 token,
 customerId: editingCustomer._id,
 name: formName.trim() || undefined,
 phone: formPhone.trim() || undefined,
 email: formEmail.trim() || undefined,
 });
 setEditingCustomer(null);
 setFormName("");
 setFormPhone("");
 setFormEmail("");
 } catch (err) {
 console.error("Failed to update customer:", err);
 alert(err instanceof Error ? err.message :"Failed to update customer");
 }
 }, [token, editingCustomer, formName, formPhone, formEmail, updateCustomer]);

 const startEdit = useCallback((customer: CustomerRow) => {
 setEditingCustomer(customer);
 setFormName(customer.name);
 setFormPhone(customer.phone ??"");
 setFormEmail(customer.email ??"");
 setShowAddForm(false);
 }, []);

 const cancelEdit = useCallback(() => {
 setEditingCustomer(null);
 setFormName("");
 setFormPhone("");
 setFormEmail("");
 }, []);

 const selectCustomer = useCallback((customerId: Id<"customers">) => {
 setSelectedCustomerId(customerId);
 setActiveTab("details");
 }, []);

 const { paginatedItems: paginatedCustomers, currentPage: custPage, totalPages: custTotalPages, setCurrentPage: setCustPage } = usePagination(customers ?? []);

 const formatDate = (ts?: number) => {
 if (!ts) return"Never";
 return new Date(ts).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
 };

 return (
 <div className="p-6 max-w-7xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Customers</h1>
 <p className="text-stone-600 text-sm mt-1">
 Manage your customer database and loyalty program
 </p>
 </div>
 <button
 onClick={() => {
 setShowAddForm(true);
 setEditingCustomer(null);
 setFormName("");
 setFormPhone("");
 setFormEmail("");
 }}
 className="px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-colors"
 >
 + Add Customer
 </button>
 </div>

 {/* Add / Edit Form */}
 {(showAddForm || editingCustomer) && (
 <div className="rounded-2xl border shadow-lg p-5 mb-6">
 <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--fg)' }}>
 {editingCustomer ?"Edit Customer" :"New Customer"}
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Name *
 </label>
 <input
 type="text"
 value={formName}
 onChange={(e) => setFormName(e.target.value)}
 placeholder="Customer name"
 className="w-full px-3 py-2 rounded-xl text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
 />
 </div>
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Phone
 </label>
 <input
 type="tel"
 value={formPhone}
 onChange={(e) => setFormPhone(e.target.value)}
 placeholder="09XX XXX XXXX"
 className="w-full px-3 py-2 rounded-xl text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
 />
 </div>
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Email
 </label>
 <input
 type="email"
 value={formEmail}
 onChange={(e) => setFormEmail(e.target.value)}
 placeholder="email@example.com"
 className="w-full px-3 py-2 rounded-xl text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
 />
 </div>
 </div>
 <div className="flex gap-2 mt-4">
 <button
 onClick={editingCustomer ? handleUpdate : handleAdd}
 disabled={!formName.trim()}
 className="px-4 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
 >
 {editingCustomer ?"Save Changes" :"Add Customer"}
 </button>
 <button
 onClick={() => {
 setShowAddForm(false);
 cancelEdit();
 }}
 className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 <div className="flex gap-6">
 {/* Customer List */}
 <div className={selectedCustomerId ?"flex-1" :"w-full"}>
 {/* Search */}
 <div className="mb-4">
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search by name or phone..."
 className="w-full px-4 py-2.5 rounded-xl text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
 />
 </div>

 {/* Table */}
 <div className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full text-sm">
 <thead>
 <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Name
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Phone
 </th>
 {!selectedCustomerId && (
 <>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Visits
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Total Spent
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Last Visit
 </th>
 </>
 )}
 <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Loyalty
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {paginatedCustomers.map((c: CustomerRow) => (
 <tr
 key={c._id}
 className={`transition-colors cursor-pointer ${
 selectedCustomerId === c._id ?"bg-amber-500/10" :""
 }`}
 onClick={() => selectCustomer(c._id)}
 style={{ borderBottom: '1px solid var(--border-color)' }}
 >
 <td className="px-5 py-3.5">
 <span className="font-medium" style={{ color: 'var(--fg)' }}>
 {c.name}
 </span>
 {c.status ==="inactive" && (
 <span className="ml-2 text-xs" style={{ color: 'var(--muted-fg)' }}>
 (inactive)
 </span>
 )}
 </td>
 <td className="px-5 py-3.5" style={{ color: 'var(--muted-fg)' }}>
 {c.phone ||"--"}
 </td>
 {!selectedCustomerId && (
 <>
 <td className="px-5 py-3.5 text-right" style={{ color: 'var(--muted-fg)' }}>
 {c.visitCount}
 </td>
 <td className="px-5 py-3.5 text-right font-medium" style={{ color: 'var(--fg)' }}>
 {formatCurrency(c.totalSpent)}
 </td>
 <td className="px-5 py-3.5" style={{ color: 'var(--muted-fg)' }}>
 {formatDate(c.lastVisitAt)}
 </td>
 </>
 )}
 <td className="px-5 py-3.5 text-center">
 {c.loyaltyCardFull ? (
 <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-400">
 Full!
 </span>
 ) : (
 <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>
 {c.loyaltyStamps}/{c.loyaltyRequired}
 </span>
 )}
 </td>
 <td className="px-5 py-3.5 text-right">
 <button
 onClick={(e) => {
 e.stopPropagation();
 startEdit(c);
 }}
 className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
 >
 Edit
 </button>
 </td>
 </tr>
 ))}
 {paginatedCustomers.length === 0 && (
 <tr>
 <td
 colSpan={selectedCustomerId ? 4 : 7}
 className="px-5 py-12 text-center"
 style={{ color: 'var(--muted-fg)' }}
 >
 {search
 ?"No customers match your search"
 :"No customers yet. Add your first customer."}
 </td>
 </tr>
 )}
 </tbody>
 </table>
 <Pagination currentPage={custPage} totalPages={custTotalPages} onPageChange={setCustPage} />
 </div>
 </div>

 {/* Customer Detail Panel */}
 {selectedCustomerId && selectedCustomer && (
 <div className="w-[420px] flex-shrink-0">
 <div className="rounded-2xl border shadow-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 {/* Header */}
 <div className="px-5 py-4 flex items-center justify-between">
 <div>
 <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>
 {selectedCustomer.name}
 </h3>
 <p className="text-xs mt-0.5">
 {selectedCustomer.phone ??"No phone"}{""}
 {selectedCustomer.email ? `| ${selectedCustomer.email}` :""}
 </p>
 </div>
 <button
 onClick={() => setSelectedCustomerId(null)}
 className="text-stone-400 p-1"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-3 divide-x divide-stone-200">
 <div className="px-4 py-3 text-center">
 <p className="text-lg font-bold">
 {selectedCustomer.visitCount}
 </p>
 <p className="text-xs">Visits</p>
 </div>
 <div className="px-4 py-3 text-center">
 <p className="text-lg font-bold">
 {formatCurrency(selectedCustomer.totalSpent)}
 </p>
 <p className="text-xs">Spent</p>
 </div>
 <div className="px-4 py-3 text-center">
 <p className="text-lg font-bold">
 {formatDate(selectedCustomer.lastVisitAt)}
 </p>
 <p className="text-xs">Last Visit</p>
 </div>
 </div>

 {/* Loyalty Card */}
 <div className="px-5 py-4">
 <LoyaltyCard
 stampsEarned={loyaltyCard?.stampsEarned ?? 0}
 stampsRequired={loyaltyCard?.stampsRequired ?? 10}
 />
 </div>

 {/* Tabs */}
 <div className="flex">
 <button
 onClick={() => setActiveTab("details")}
 className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
 activeTab ==="details"
 ?"text-amber-700-2 border-amber-600"
 :"text-stone-500"
 }`}
 >
 Details
 </button>
 <button
 onClick={() => setActiveTab("orders")}
 className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
 activeTab ==="orders"
 ?"text-amber-700-2 border-amber-600"
 :"text-stone-500"
 }`}
 >
 Orders
 </button>
 <button
 onClick={() => setActiveTab("favorites")}
 className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
 activeTab ==="favorites"
 ?"text-amber-700-2 border-amber-600"
 :"text-stone-500"
 }`}
 >
 Favorites
 </button>
 </div>

 {/* Tab Content */}
 <div className="max-h-[400px] overflow-y-auto">
 {activeTab ==="details" && (
 <div className="px-5 py-4 space-y-3">
 <div>
 <p className="text-xs uppercase tracking-wide">
 Status
 </p>
 <p className="text-sm capitalize mt-0.5">
 {selectedCustomer.status}
 </p>
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide">
 Email
 </p>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 {selectedCustomer.email ||"Not provided"}
 </p>
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide">
 Phone
 </p>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 {selectedCustomer.phone ||"Not provided"}
 </p>
 </div>
 </div>
 )}

 {activeTab ==="orders" && (
 <div className="divide-y divide-stone-100">
 {(customerOrders ?? []).length === 0 ? (
 <div className="px-5 py-8 text-center text-sm">
 No orders yet
 </div>
 ) : (
 (customerOrders ?? []).map((order: CustomerOrder) => (
 <div key={order._id} className="px-5 py-3">
 <div className="flex items-center justify-between">
 <span className="text-xs font-mono">
 {order.orderNumber ??"N/A"}
 </span>
 <span className="text-sm font-medium">
 {formatCurrency(order.total)}
 </span>
 </div>
 <p className="text-xs mt-0.5">
 {formatDate(order.completedAt)} |{""}
 {order.paymentType ??"cash"}
 </p>
 <div className="mt-1">
 {order.items.map(
 (
 item: {
 itemName: string;
 quantity: number;
 subtotal: number;
 },
 idx: number
 ) => (
 <span
 key={idx}
 className="text-xs mr-2"
 >
 {item.quantity}x {item.itemName}
 </span>
 )
 )}
 </div>
 </div>
 ))
 )}
 </div>
 )}

 {activeTab ==="favorites" && (
 <div className="px-5 py-4">
 {(customerFavorites ?? []).length === 0 ? (
 <div className="text-center text-sm py-4">
 No favorites yet
 </div>
 ) : (
 <div className="space-y-2">
 {(customerFavorites ?? []).map(
 (fav: CustomerFavorite, idx: number) => (
 <div
 key={idx}
 className="flex items-center justify-between py-2 px-3 rounded-xl"
 >
 <span className="text-sm font-medium">
 {fav.itemName}
 </span>
 <span className="text-xs">
 {fav.count} ordered
 </span>
 </div>
 )
 )}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
