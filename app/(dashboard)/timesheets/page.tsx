"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../convex/_generated/dataModel";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency } from "@/lib/currency";
import { TimesheetDetailModal } from "@/components/timesheets/timesheet-detail-modal";

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
};

type LocationOption = { _id: Id<"locations">; name: string };
type StaffOption = { _id: Id<"users">; name: string };

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday-start
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function fromDateInputValue(v: string, end = false): number {
  const d = new Date(v);
  if (end) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatTime(ms?: number): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(minutes?: number): string {
  if (!minutes) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function TimesheetsPage() {
  const { token, session } = useAuth();
  const isOwnerOrManager =
    session?.role === "owner" || session?.role === "manager";

  const today = new Date();
  const [startDate, setStartDate] = useState<string>(
    toDateInputValue(startOfWeek(today))
  );
  const [endDate, setEndDate] = useState<string>(toDateInputValue(today));
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterLocationId, setFilterLocationId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selectedId, setSelectedId] = useState<Id<"timesheets"> | null>(null);

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const staff = useQuery(
    api.staff.queries.listAll,
    token && isOwnerOrManager ? { token } : "skip"
  ) as StaffOption[] | undefined;

  const timesheets = useQuery(
    api.timesheets.queries.listTimesheets,
    token
      ? {
          token,
          startDate: fromDateInputValue(startDate),
          endDate: fromDateInputValue(endDate, true),
          userId: filterUserId
            ? (filterUserId as Id<"users">)
            : undefined,
          locationId: filterLocationId
            ? (filterLocationId as Id<"locations">)
            : undefined,
          status: filterStatus
            ? (filterStatus as "active" | "on_break" | "completed" | "auto_closed")
            : undefined,
        }
      : "skip"
  ) as TimesheetRow[] | undefined;

  const stats = useMemo(() => {
    const rows = timesheets ?? [];
    const totalMinutes = rows.reduce((s, r) => s + (r.workMinutes ?? 0), 0);
    const totalEarned = rows.reduce((s, r) => s + (r.earnedAmount ?? 0), 0);
    const activeNow = rows.filter((r) => r.status === "active").length;
    const pendingApproval = rows.filter(
      (r) => r.status === "completed" && !r.approvedAt
    ).length;
    return { totalMinutes, totalEarned, activeNow, pendingApproval };
  }, [timesheets]);

  const {
    paginatedItems,
    currentPage,
    totalPages,
    setCurrentPage,
  } = usePagination(timesheets ?? [], 15);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  const handleExportCsv = () => {
    const rows = timesheets ?? [];
    const header = [
      "Staff",
      "Date",
      "Clock In",
      "Clock Out",
      "Hours",
      "Break Min",
      "OT Hours",
      "OT Amount",
      "Hourly Rate",
      "Earned",
      "Status",
      "Approved",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.userName,
        formatDate(r.clockInAt),
        formatTime(r.clockInAt),
        formatTime(r.clockOutAt),
        formatHours(r.workMinutes),
        String(r.breakMinutes ?? 0),
        formatHours(r.overtimeMinutes),
        r.overtimeAmount !== undefined ? formatCurrency(r.overtimeAmount) : "",
        r.hourlyRate !== undefined ? formatCurrency(r.hourlyRate) : "",
        r.earnedAmount !== undefined ? formatCurrency(r.earnedAmount) : "",
        r.status,
        r.approvedAt ? "yes" : "no",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1
            className="text-lg md:text-xl font-bold"
            style={{ color: "var(--fg)" }}
          >
            Timesheets
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-fg)" }}
          >
            {isOwnerOrManager
              ? "Track staff hours, payroll, and approvals"
              : "Your clock-in history"}
          </p>
        </div>
        {isOwnerOrManager && (
          <button
            onClick={handleExportCsv}
            className="px-4 py-3 text-sm font-bold rounded-2xl shadow-lg self-start md:self-auto"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "white",
            }}
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        className="rounded-3xl shadow-lg p-5 flex flex-wrap gap-3 items-end"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-2xl px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          />
        </div>
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-2xl px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          />
        </div>
        {isOwnerOrManager && (
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--muted-fg)" }}
            >
              Staff
            </label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="rounded-2xl px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <option value="">All Staff</option>
              {(staff ?? []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            Location
          </label>
          <select
            value={filterLocationId}
            onChange={(e) => setFilterLocationId(e.target.value)}
            className="rounded-2xl px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <option value="">All Locations</option>
            {(locations ?? []).map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-2xl px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="on_break">On Break</option>
            <option value="completed">Completed</option>
            <option value="auto_closed">Auto-Closed</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Hours" value={formatHours(stats.totalMinutes)} />
        <StatCard
          label="Total Payroll"
          value={formatCurrency(stats.totalEarned)}
        />
        <StatCard label="Active Now" value={String(stats.activeNow)} />
        <StatCard
          label="Pending Approval"
          value={String(stats.pendingApproval)}
        />
      </div>

      {/* Table */}
      <div
        className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <table className="w-full min-w-200 text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--muted)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <Th>Photo</Th>
              <Th>Staff</Th>
              <Th>Date</Th>
              <Th>Clock In</Th>
              <Th>Clock Out</Th>
              <Th>Hours</Th>
              <Th>Break</Th>
              <Th>OT Hours</Th>
              <Th>Rate</Th>
              <Th>Earned</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {timesheets === undefined ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-5 py-12 text-center"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Loading...
                </td>
              </tr>
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-5 py-12 text-center"
                  style={{ color: "var(--muted-fg)" }}
                >
                  No timesheets found
                </td>
              </tr>
            ) : (
              paginatedItems.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => setSelectedId(row._id)}
                  className="cursor-pointer hover:bg-white/5"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td className="px-5 py-3.5">
                    <PhotoThumb
                      photoId={row.clockInPhotoId}
                      flagged={!!row.photoFlagged}
                    />
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--fg)" }}>
                    {row.userName}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {formatDate(row.clockInAt)}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {formatTime(row.clockInAt)}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {formatTime(row.clockOutAt)}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {formatHours(row.workMinutes)}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {row.breakMinutes ? `${row.breakMinutes}m` : "-"}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {row.overtimeMinutes ? formatHours(row.overtimeMinutes) : "-"}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {row.hourlyRate !== undefined ? formatCurrency(row.hourlyRate) : "-"}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--fg)" }}>
                    {row.earnedAmount !== undefined ? formatCurrency(row.earnedAmount) : "-"}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={row.status} approved={!!row.approvedAt} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {selectedId && (
        <TimesheetDetailModal
          timesheetId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function PhotoThumb({
  photoId,
  flagged,
}: {
  photoId?: Id<"_storage">;
  flagged: boolean;
}) {
  const url = useQuery(
    api.timesheets.photoMutations.getPhotoUrl,
    photoId ? { photoId } : "skip"
  );
  if (!photoId) {
    return (
      <div
        className="w-8 h-8 rounded-full"
        style={{ backgroundColor: "var(--muted)" }}
      />
    );
  }
  if (!url) {
    return (
      <div
        className="w-8 h-8 rounded-full"
        style={{ backgroundColor: "var(--muted)" }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Clock-in"
      className="w-8 h-8 rounded-full object-cover"
      style={{
        border: flagged ? "2px solid #ef4444" : "1px solid var(--border-color)",
      }}
    />
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
      style={{ color: "var(--muted-fg)" }}
    >
      {children}
    </th>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-3xl shadow-lg p-6"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold mt-2" style={{ color: "var(--fg)" }}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  approved,
}: {
  status: "active" | "on_break" | "completed" | "auto_closed";
  approved: boolean;
}) {
  if (status === "active") {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
        Active
      </span>
    );
  }
  if (status === "on_break") {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
        On Break
      </span>
    );
  }
  if (status === "auto_closed") {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
        Auto-Closed
      </span>
    );
  }
  if (approved) {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-stone-500/10 text-stone-400">
      Completed
    </span>
  );
}
