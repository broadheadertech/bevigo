"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import {
  LocationForm,
  LocationFormData,
  LocationData,
} from "@/components/locations/location-form";

export default function LocationsPage() {
  const { token } = useAuth();

  const locations = useQuery(
    api.locations.queries.listLocations,
    token ? { token } : "skip"
  );
  const createLocation = useMutation(api.locations.mutations.createLocation);
  const updateLocation = useMutation(api.locations.mutations.updateLocation);

  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const openAdd = () => {
    setEditingLocation(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (loc: LocationData) => {
    setEditingLocation(loc);
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLocation(null);
    setError(null);
  };

  const handleSubmit = async (data: LocationFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const taxRateBasisPoints = Math.round(
        parseFloat(data.taxRate || "0") * 100
      );

      if (editingLocation) {
        await updateLocation({
          token,
          locationId: editingLocation._id,
          name: data.name,
          slug: data.slug,
          address: data.address || undefined,
          timezone: data.timezone,
          taxRate: taxRateBasisPoints,
          taxLabel: data.taxLabel,
          currency: data.currency,
          operatingHours: data.operatingHours,
          status: data.status,
        });
      } else {
        await createLocation({
          token,
          name: data.name,
          slug: data.slug,
          address: data.address || undefined,
          timezone: data.timezone,
          taxRate: taxRateBasisPoints,
          taxLabel: data.taxLabel,
          currency: data.currency,
          operatingHours: data.operatingHours,
          status: data.status,
        });
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const typedLocations = locations as LocationData[] | undefined;

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-stone-900">Locations</h1>
          <p className="text-sm text-stone-500 mt-0.5">Manage your store branches and settings</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-sm"
        >
          + Add Location
        </button>
      </div>

      {/* Location Cards Grid */}
      {typedLocations === undefined ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-stone-400">Loading locations...</p>
        </div>
      ) : typedLocations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400">
          <p className="text-lg mb-2">No locations yet</p>
          <p className="text-sm">
            Click &quot;Add Location&quot; to create your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {typedLocations.map((loc) => (
            <div
              key={loc._id}
              onClick={() => openEdit(loc)}
              className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-stone-300/60 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-stone-900 text-lg">{loc.name}</h3>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                    loc.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {loc.status}
                </span>
              </div>

              {loc.address && (
                <p className="text-sm text-stone-500 mb-3">{loc.address}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1 text-stone-600">
                  <span className="text-stone-400">{loc.taxLabel}</span>{" "}
                  {(loc.taxRate / 100).toFixed(2)}%
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-stone-50 rounded-full text-xs font-medium text-stone-600">
                  {loc.currency}
                </span>
              </div>

              {loc.staffCount !== undefined && (
                <p className="text-xs text-stone-400 mt-3 pt-3 border-t border-stone-100">
                  {loc.staffCount} staff member{loc.staffCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <LocationForm
          editingLocation={editingLocation}
          onSubmit={handleSubmit}
          onClose={closeForm}
          error={error}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
