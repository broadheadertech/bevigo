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
          <h1 className="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100">Staff</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Manage your team members and roles</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 active:bg-stone-700 transition-colors shadow-sm self-start md:self-auto"
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
            className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors capitalize ${
              filterRole === role
                ? "bg-stone-900 text-white"
                : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700"
            }`}
          >
            {role === "all" ? "All Roles" : role}
          </button>
        ))}
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-stone-50/50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Role</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Location(s)</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {typedStaffList === undefined ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                  Loading staff...
                </td>
              </tr>
            ) : filteredStaff && filteredStaff.length > 0 ? (
              filteredStaff.map((staff) => (
                <tr key={staff._id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-amber-700">
                          {getInitials(staff.name)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-stone-900 dark:text-stone-100">{staff.name}</div>
                        {staff.email && (
                          <div className="text-sm text-stone-400">{staff.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                      staff.role === "owner"
                        ? "bg-amber-100 text-amber-800"
                        : staff.role === "manager"
                          ? "bg-stone-100 text-stone-700"
                          : "bg-stone-50 dark:bg-stone-800 text-stone-500"
                    }`}>
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-stone-600 dark:text-stone-400">
                    {staff.locations.length > 0
                      ? staff.locations.map((l) => l.locationName).join(", ")
                      : <span className="text-stone-400">No locations</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                        staff.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openEditForm(staff)}
                      className="text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md p-6 border border-stone-200/60">
            <h2 className="text-lg font-bold text-stone-900 mb-4">
              {editingId ? "Edit Staff" : "Add Staff"}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
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
                  className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                >
                  {session.role === "owner" && <option value="owner">Owner</option>}
                  {session.role === "owner" && <option value="manager">Manager</option>}
                  <option value="barista">Barista</option>
                </select>
              </div>

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
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
                    className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
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
                  className="px-4 py-2.5 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
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
