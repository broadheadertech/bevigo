"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";

type Props = {
  timesheetId: Id<"timesheets">;
  onClose: () => void;
};

type TimesheetRow = {
  _id: Id<"timesheets">;
  userId: Id<"users">;
  userName: string;
  locationId: Id<"locations">;
  locationName: string;
  clockInAt: number;
  clockOutAt?: number;
  workMinutes?: number;
  breakMinutes?: number;
  overtimeMinutes?: number;
  overtimeAmount?: number;
  hourlyRate?: number;
  earnedAmount?: number;
  status: "active" | "on_break" | "completed" | "auto_closed";
  approvedBy?: Id<"users">;
  approvedAt?: number;
  notes?: string;
  clockInPhotoId?: Id<"_storage">;
  clockOutPhotoId?: Id<"_storage">;
  clockInFaceMatch?: number;
  clockOutFaceMatch?: number;
  photoFlagged?: boolean;
  editedBy?: Id<"users">;
  editedAt?: number;
  editReason?: string;
};

function formatTime(ms?: number) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHours(minutes?: number) {
  if (!minutes) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimesheetDetailModal({ timesheetId, onClose }: Props) {
  const { token, session } = useAuth();
  const isOwnerOrManager =
    session?.role === "owner" || session?.role === "manager";

  const timesheets = useQuery(
    api.timesheets.queries.listTimesheets,
    token ? { token } : "skip"
  ) as TimesheetRow[] | undefined;

  const row = useMemo(
    () => timesheets?.find((t) => t._id === timesheetId),
    [timesheets, timesheetId]
  );

  const breaks = useQuery(
    api.timesheets.queries.listBreaks,
    token ? { token, timesheetId } : "skip"
  );

  const editHistory = useQuery(
    api.timesheets.queries.listEditHistory,
    token && isOwnerOrManager ? { token, timesheetId } : "skip"
  );

  const updateTimesheet = useMutation(api.timesheets.mutations.updateTimesheet);
  const approveTimesheet = useMutation(
    api.timesheets.mutations.approveTimesheet
  );
  const togglePhotoFlag = useMutation(
    api.timesheets.photoMutations.togglePhotoFlag
  );

  const clockInPhotoUrl = useQuery(
    api.timesheets.photoMutations.getPhotoUrl,
    row?.clockInPhotoId ? { photoId: row.clockInPhotoId } : "skip"
  );
  const clockOutPhotoUrl = useQuery(
    api.timesheets.photoMutations.getPhotoUrl,
    row?.clockOutPhotoId ? { photoId: row.clockOutPhotoId } : "skip"
  );

  const [editing, setEditing] = useState(false);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    if (!row) return;
    setEditClockIn(toLocalInputValue(row.clockInAt));
    setEditClockOut(row.clockOutAt ? toLocalInputValue(row.clockOutAt) : "");
    setEditNotes(row.notes ?? "");
    setEditReason("");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!token || !row) return;
    if (!editReason.trim()) {
      setError("Reason for edit is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTimesheet({
        token,
        timesheetId: row._id,
        clockInAt: new Date(editClockIn).getTime(),
        clockOutAt: editClockOut ? new Date(editClockOut).getTime() : undefined,
        notes: editNotes,
        reason: editReason,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!token || !row) return;
    try {
      await approveTimesheet({ token, timesheetId: row._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const regularMinutes = Math.max(
    0,
    (row?.workMinutes ?? 0) - (row?.overtimeMinutes ?? 0)
  );
  const regularPay = (row?.earnedAmount ?? 0) - (row?.overtimeAmount ?? 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-2xl mx-4 my-auto"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div
          className="flex items-center justify-between p-6"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Timesheet Details
            </h2>
            {row && (
              <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                {row.userName} · {row.locationName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-2xl px-2"
            style={{ color: "var(--muted-fg)" }}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {!row ? (
            <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
          ) : (
            <>
              {!editing && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Clock In" value={formatTime(row.clockInAt)} />
                    <Field label="Clock Out" value={formatTime(row.clockOutAt)} />
                    <Field label="Total Worked" value={formatHours(row.workMinutes)} />
                    <Field label="Break Total" value={formatHours(row.breakMinutes)} />
                    <Field label="Regular Hours" value={formatHours(regularMinutes)} />
                    <Field label="OT Hours" value={formatHours(row.overtimeMinutes)} />
                    <Field
                      label="Hourly Rate"
                      value={
                        row.hourlyRate !== undefined
                          ? formatCurrency(row.hourlyRate)
                          : "-"
                      }
                    />
                    <Field
                      label="Status"
                      value={row.status.replace("_", " ")}
                    />
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "var(--muted)" }}
                  >
                    <h3
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Earned Breakdown
                    </h3>
                    <div
                      className="flex justify-between text-sm"
                      style={{ color: "var(--fg)" }}
                    >
                      <span>Regular pay</span>
                      <span>{formatCurrency(regularPay)}</span>
                    </div>
                    <div
                      className="flex justify-between text-sm"
                      style={{ color: "var(--fg)" }}
                    >
                      <span>Overtime pay</span>
                      <span>{formatCurrency(row.overtimeAmount ?? 0)}</span>
                    </div>
                    <div
                      className="flex justify-between text-base font-bold mt-2 pt-2"
                      style={{
                        color: "var(--fg)",
                        borderTop: "1px solid var(--border-color)",
                      }}
                    >
                      <span>Total earned</span>
                      <span>{formatCurrency(row.earnedAmount ?? 0)}</span>
                    </div>
                  </div>

                  <div>
                    <h3
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Breaks ({breaks?.length ?? 0})
                    </h3>
                    {!breaks || breaks.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                        No breaks recorded
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {breaks.map((b) => (
                          <li
                            key={b._id}
                            className="text-sm flex justify-between"
                            style={{ color: "var(--fg)" }}
                          >
                            <span>
                              {formatTime(b.startedAt)} →{" "}
                              {b.endedAt ? formatTime(b.endedAt) : "ongoing"}
                            </span>
                            <span style={{ color: "var(--muted-fg)" }}>
                              {b.durationMinutes ?? 0} min ({b.type})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {(row.clockInPhotoId || row.clockOutPhotoId) && (
                    <div>
                      <h3
                        className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center justify-between"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        <span>Clock Photos</span>
                        {isOwnerOrManager && (
                          <button
                            onClick={async () => {
                              if (!token) return;
                              try {
                                await togglePhotoFlag({
                                  token,
                                  timesheetId: row._id,
                                  flagged: !row.photoFlagged,
                                });
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Failed"
                                );
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-medium normal-case"
                            style={{
                              border: "1px solid var(--border-color)",
                              color: row.photoFlagged ? "#ef4444" : "var(--fg)",
                            }}
                          >
                            {row.photoFlagged ? "Unflag" : "Flag"}
                          </button>
                        )}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <PhotoCell
                          label="Clock In"
                          url={clockInPhotoUrl}
                          faceMatch={row.clockInFaceMatch}
                          flagged={!!row.photoFlagged}
                        />
                        <PhotoCell
                          label="Clock Out"
                          url={clockOutPhotoUrl}
                          faceMatch={row.clockOutFaceMatch}
                          flagged={!!row.photoFlagged}
                        />
                      </div>
                    </div>
                  )}

                  {row.notes && (
                    <div>
                      <h3
                        className="text-xs font-semibold uppercase tracking-widest mb-1"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        Notes
                      </h3>
                      <p className="text-sm" style={{ color: "var(--fg)" }}>
                        {row.notes}
                      </p>
                    </div>
                  )}

                  {isOwnerOrManager && editHistory && editHistory.length > 0 && (
                    <div>
                      <h3
                        className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        Edit History
                      </h3>
                      <ul className="space-y-2">
                        {editHistory.map((e) => (
                          <li
                            key={e._id}
                            className="text-xs rounded-xl p-2"
                            style={{
                              backgroundColor: "var(--muted)",
                              color: "var(--fg)",
                            }}
                          >
                            <div className="font-semibold">
                              {e.editedByName} changed {e.field}
                            </div>
                            <div style={{ color: "var(--muted-fg)" }}>
                              {String(e.oldValue ?? "—")} →{" "}
                              {String(e.newValue ?? "—")}
                            </div>
                            {e.reason && (
                              <div style={{ color: "var(--muted-fg)" }}>
                                Reason: {e.reason}
                              </div>
                            )}
                            <div style={{ color: "var(--muted-fg)" }}>
                              {new Date(e.createdAt).toLocaleString()}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {editing && (
                <div className="space-y-3">
                  <div>
                    <label
                      className="block text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Clock In
                    </label>
                    <input
                      type="datetime-local"
                      value={editClockIn}
                      onChange={(e) => setEditClockIn(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Clock Out
                    </label>
                    <input
                      type="datetime-local"
                      value={editClockOut}
                      onChange={(e) => setEditClockOut(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-2xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Reason for Edit *
                    </label>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {row && (
          <div
            className="flex items-center justify-end gap-3 p-6"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-medium"
                  style={{
                    border: "1px solid var(--border-color)",
                    color: "var(--fg)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                {isOwnerOrManager &&
                  (row.status === "completed" || row.status === "auto_closed") &&
                  !row.approvedAt && (
                    <button
                      onClick={handleApprove}
                      className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
                      style={{ backgroundColor: "rgb(16,185,129)" }}
                    >
                      Approve
                    </button>
                  )}
                {isOwnerOrManager && (
                  <button
                    onClick={startEdit}
                    className="px-4 py-2.5 rounded-2xl text-sm font-medium"
                    style={{
                      border: "1px solid var(--border-color)",
                      color: "var(--fg)",
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoCell({
  label,
  url,
  faceMatch,
  flagged,
}: {
  label: string;
  url: string | null | undefined;
  faceMatch?: number;
  flagged: boolean;
}) {
  const matchColor =
    faceMatch === undefined
      ? "var(--muted-fg)"
      : faceMatch >= 0.7
        ? "#22c55e"
        : faceMatch >= 0.5
          ? "#f59e0b"
          : "#ef4444";
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className="w-full rounded-2xl object-cover"
          style={{
            border: flagged
              ? "2px solid #ef4444"
              : "1px solid var(--border-color)",
          }}
        />
      ) : (
        <div
          className="w-full aspect-square rounded-2xl flex items-center justify-center text-xs"
          style={{
            backgroundColor: "var(--muted)",
            border: "1px solid var(--border-color)",
            color: "var(--muted-fg)",
          }}
        >
          No photo
        </div>
      )}
      {faceMatch !== undefined && (
        <p className="text-xs mt-1" style={{ color: matchColor }}>
          Match: {Math.round(faceMatch * 100)}%
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5" style={{ color: "var(--fg)" }}>
        {value}
      </p>
    </div>
  );
}
