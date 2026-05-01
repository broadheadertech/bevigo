"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../convex/_generated/dataModel";
import { useConfirm } from "@/lib/confirm-context";

type Supplier = {
  _id: Id<"suppliers">;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: "active" | "inactive";
};

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function SuppliersPage() {
  const { token, session } = useAuth();
  const confirm = useConfirm();

  const suppliers = useQuery(
    api.suppliers.queries.list,
    token ? { token } : "skip"
  ) as Supplier[] | undefined;

  const createSupplier = useMutation(api.suppliers.mutations.create);
  const updateSupplier = useMutation(api.suppliers.mutations.update);
  const removeSupplier = useMutation(api.suppliers.mutations.remove);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  const canEdit = session.role === "owner" || session.role === "manager";

  const openAdd = () => {
    setForm(emptyForm);
    setEditing(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setEditing(s);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateSupplier({
          token,
          supplierId: editing._id,
          name: form.name,
          contactName: form.contactName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          notes: form.notes,
        });
      } else {
        await createSupplier({
          token,
          name: form.name,
          contactName: form.contactName || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!token) return;
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      message:
        "This permanently removes the supplier. Any ingredient or product still pointing at it must be reassigned first — otherwise deletion will be blocked.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeSupplier({ token, supplierId: s._id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleToggleStatus = async (s: Supplier) => {
    if (!token) return;
    await updateSupplier({
      token,
      supplierId: s._id,
      status: s.status === "active" ? "inactive" : "active",
    });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            Suppliers
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Vendors that supply ingredients or finished products. Optional per item.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2.5 text-sm font-bold rounded-2xl shadow-lg active:scale-95 transition-all self-start md:self-auto"
            style={{ backgroundColor: "var(--accent-color)", color: "white" }}
          >
            + Add Supplier
          </button>
        )}
      </div>

      <div
        className="rounded-3xl shadow-lg overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border-color)" }}>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Contact</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers === undefined ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center" style={{ color: "var(--muted-fg)" }}>
                  Loading suppliers…
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center" style={{ color: "var(--muted-fg)" }}>
                  No suppliers yet. Add one to start linking ingredients and products.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s._id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td className="px-5 py-3.5">
                    <div className="font-medium" style={{ color: "var(--fg)" }}>{s.name}</div>
                    {s.email && (
                      <div className="text-xs" style={{ color: "var(--muted-fg)" }}>{s.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-fg)" }}>
                    {s.contactName ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-fg)" }}>
                    {s.phone ?? "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${s.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-stone-500/10 text-stone-500"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {canEdit && (
                      <span className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-sm font-medium text-amber-400 hover:text-amber-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className="text-sm font-medium hover:opacity-80"
                          style={{ color: "var(--muted-fg)" }}
                        >
                          {s.status === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                        {session.role === "owner" && (
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-sm font-medium text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setShowForm(false);
          }}
        >
          <div
            className="rounded-3xl shadow-2xl w-full max-w-md p-6"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>
              {editing ? "Edit Supplier" : "Add Supplier"}
            </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Name *" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Doming Coffee Roasters" />
              <Field label="Contact person" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} placeholder="Optional" />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="Optional" />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="Optional" />
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Optional" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                  style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                  placeholder="Lead time, payment terms, MOQ, anything useful…"
                />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={busy}
                  className="px-4 py-3 rounded-2xl text-sm font-medium"
                  style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-3.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  {busy ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
        style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
      />
    </div>
  );
}
