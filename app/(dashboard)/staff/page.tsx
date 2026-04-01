"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";

type StaffLocation = {
  locationId: Id<"locations">;
  locationName: string;
};

type StaffMember = {
  _id: Id<"users">;
  name: string;
  email?: string;
  role: "owner" | "manager" | "barista";
  status: string;
  locations: StaffLocation[];
  updatedAt: number;
};

type StaffFormData = {
  name: string;
  email: string;
  role: "owner" | "manager" | "barista";
  quickPin: string;
  locationIds: Id<"locations">[];
};

const emptyForm: StaffFormData = {
  name: "",
  email: "",
  role: "barista",
  quickPin: "",
  locationIds: [],
};

const ROLE_FILTERS = ["all", "owner", "manager", "barista"] as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function StaffPage() {
  const { session, token } = useAuth();

  const staffList = useQuery(
    api.staff.queries.list,
    token ? { token } : "skip"
  );
  const createStaff = useAction(api.staff.mutations.create);
  const updateStaff = useMutation(api.staff.mutations.update);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"users"> | null>(null);
  const [form, setForm] = useState<StaffFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterRole, setFilterRole] = useState<string>("all");

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const typedStaffList = staffList as StaffMember[] | undefined;
  const filteredStaff = typedStaffList?.filter((s: StaffMember) => {
    if (filterRole !== "all" && s.role !== filterRole) return false;
    return true;
  });

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (staff: StaffMember) => {
    setForm({
      name: staff.name,
      email: staff.email || "",
      role: staff.role,
      quickPin: "",
      locationIds: staff.locations.map((l) => l.locationId),
    });
    setEditingId(staff._id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        await updateStaff({
          token,
          userId: editingId,
          name: form.name,
          email: form.email || undefined,
          role: form.role,
          locationIds: form.locationIds,
        });
      } else {
        await createStaff({
          token,
          name: form.name,
          email: form.email || undefined,
          role: form.role,
          locationIds: form.locationIds,
          quickPin: form.quickPin || undefined,
        });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--fg)' }}>Staff</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>Manage your team members and roles</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-3.5 text-sm font-bold rounded-2xl hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-lg self-start md:self-auto"
          style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
        >
          + Add Staff
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {ROLE_FILTERS.map((role) => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className="px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors capitalize"
            style={filterRole === role
              ? { backgroundColor: 'var(--accent-color)', color: 'white' }
              : { backgroundColor: 'var(--card)', border: '1px solid var(--border-color)', color: 'var(--muted-fg)' }
            }
          >
            {role === "all" ? "All Roles" : role}
          </button>
        ))}
      </div>

      {/* Staff Table */}
      <div className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
        <table className="w-full min-w-150">
          <thead style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest">Location(s)</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {typedStaffList === undefined ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                  Loading staff...
                </td>
              </tr>
            ) : filteredStaff && filteredStaff.length > 0 ? (
              filteredStaff.map((staff) => (
                <tr key={staff._id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-amber-400">
                          {getInitials(staff.name)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--fg)' }}>{staff.name}</div>
                        {staff.email && (
                          <div className="text-sm" style={{ color: 'var(--muted-fg)' }}>{staff.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                      staff.role === "owner"
                        ? "bg-amber-500/15 text-amber-400"
                        : staff.role === "manager"
                          ? "bg-stone-500/10 text-stone-400"
                          : "bg-stone-500/10 text-stone-500"
                    }`}>
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--muted-fg)' }}>
                    {staff.locations.length > 0
                      ? staff.locations.map((l) => l.locationName).join(", ")
                      : <span className="text-stone-400">No locations</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                        staff.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-stone-500/10 text-stone-500"
                      }`}
                    >
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openEditForm(staff)}
                      className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-3xl shadow-2xl w-full max-w-md p-8" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
              {editingId ? "Edit Staff" : "Add Staff"}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "owner" | "manager" | "barista",
                    })
                  }
                  className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
                >
                  {session.role === "owner" && <option value="owner">Owner</option>}
                  {session.role === "owner" && <option value="manager">Manager</option>}
                  <option value="barista">Barista</option>
                </select>
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
                    Quick-PIN (4-6 digits, optional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    maxLength={6}
                    value={form.quickPin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quickPin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
                    placeholder="e.g. 1234"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setError(null);
                  }}
                  className="px-4 py-3 rounded-2xl text-sm font-medium transition-colors"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--fg)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 text-sm"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
