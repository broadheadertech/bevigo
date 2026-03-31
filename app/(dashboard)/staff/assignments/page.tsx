"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";

type MatrixUser = {
  userId: Id<"users">;
  userName: string;
  userRole: "owner" | "manager" | "barista";
  userEmail: string | null;
  assignedLocationIds: Id<"locations">[];
};

type MatrixLocation = {
  locationId: Id<"locations">;
  locationName: string;
};

type AssignmentMatrix = {
  users: MatrixUser[];
  locations: MatrixLocation[];
};

export default function StaffAssignmentsPage() {
  const { session, token } = useAuth();

  const matrix = useQuery(
    api.staffLocations.queries.getAssignmentMatrix,
    token ? { token } : "skip"
  ) as AssignmentMatrix | undefined;

  const bulkAssign = useMutation(api.staffLocations.mutations.bulkAssign);

  const [pendingChanges, setPendingChanges] = useState<
    Map<string, boolean>
  >(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (session.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Only owners can manage staff-location assignments.</p>
      </div>
    );
  }

  if (matrix === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading assignment matrix...</p>
      </div>
    );
  }

  const { users, locations } = matrix;

  const getCellKey = (userId: Id<"users">, locationId: Id<"locations">) =>
    `${userId}:${locationId}`;

  const isAssigned = (user: MatrixUser, locationId: Id<"locations">) => {
    const key = getCellKey(user.userId, locationId);
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    return user.assignedLocationIds.includes(locationId);
  };

  const toggleAssignment = (userId: Id<"users">, locationId: Id<"locations">, currentlyAssigned: boolean) => {
    const key = getCellKey(userId, locationId);
    const user = users.find((u) => u.userId === userId);
    if (!user) return;

    const originalValue = user.assignedLocationIds.includes(locationId);
    const newValue = !currentlyAssigned;

    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (newValue === originalValue) {
        // Revert to original -- remove from pending
        next.delete(key);
      } else {
        next.set(key, newValue);
      }
      return next;
    });
    setError(null);
    setSuccessMessage(null);
  };

  const hasPendingChanges = pendingChanges.size > 0;

  const saveChanges = async () => {
    if (!hasPendingChanges || !token) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Group changes by user for bulk operations
      const changesByUser = new Map<Id<"users">, Map<Id<"locations">, boolean>>();

      for (const [key, value] of pendingChanges) {
        const [userId, locationId] = key.split(":") as [Id<"users">, Id<"locations">];
        if (!changesByUser.has(userId)) {
          changesByUser.set(userId, new Map());
        }
        changesByUser.get(userId)!.set(locationId, value);
      }

      // For each user with changes, compute the desired final state and bulkAssign
      for (const [userId, locationChanges] of changesByUser) {
        const user = users.find((u) => u.userId === userId);
        if (!user) continue;

        // Start with current assignments
        const finalLocationIds = new Set(user.assignedLocationIds);

        for (const [locationId, shouldBeAssigned] of locationChanges) {
          if (shouldBeAssigned) {
            finalLocationIds.add(locationId);
          } else {
            finalLocationIds.delete(locationId);
          }
        }

        await bulkAssign({
          token,
          userId,
          locationIds: [...finalLocationIds],
        });
      }

      setPendingChanges(new Map());
      setSuccessMessage("Assignments updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    setError(null);
    setSuccessMessage(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "manager":
        return "bg-blue-100 text-blue-700";
      case "barista":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff-Location Assignments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Check or uncheck boxes to assign staff to locations. Save when done.
          </p>
        </div>
        <div className="flex gap-3">
          {hasPendingChanges && (
            <button
              onClick={discardChanges}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
          )}
          <button
            onClick={saveChanges}
            disabled={!hasPendingChanges || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
          {successMessage}
        </div>
      )}

      {hasPendingChanges && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-sm">
          You have unsaved changes ({pendingChanges.size} assignment{pendingChanges.size !== 1 ? "s" : ""} modified).
        </div>
      )}

      {users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No active staff members found. Add staff first.
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No active locations found. Create locations first.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">
                  Staff Member
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  Role
                </th>
                {locations.map((loc) => (
                  <th
                    key={loc.locationId}
                    className="text-center px-4 py-3 text-sm font-medium text-gray-500 min-w-[120px]"
                  >
                    {loc.locationName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.userId}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="font-medium">{user.userName}</div>
                    {user.userEmail && (
                      <div className="text-sm text-gray-500">{user.userEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(user.userRole)}`}
                    >
                      {user.userRole}
                    </span>
                  </td>
                  {locations.map((loc) => {
                    const assigned = isAssigned(user, loc.locationId);
                    const key = getCellKey(user.userId, loc.locationId);
                    const isPending = pendingChanges.has(key);

                    return (
                      <td
                        key={loc.locationId}
                        className={`text-center px-4 py-3 ${isPending ? "bg-yellow-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={() =>
                            toggleAssignment(user.userId, loc.locationId, assigned)
                          }
                          disabled={isSubmitting}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
