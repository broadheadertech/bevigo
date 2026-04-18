"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type TrayTable = {
  _id: Id<"tables">;
  name: string;
  capacity: number;
  shape: "rectangle" | "circle";
};

type UnpositionedTrayProps = {
  locationId: Id<"locations">;
};

export function UnpositionedTray({ locationId }: UnpositionedTrayProps) {
  const { token } = useAuth();
  const tables = useQuery(
    api.floors.queries.listUnpositionedTables,
    token ? { token, locationId } : "skip"
  ) as TrayTable[] | undefined;

  if (tables === undefined) return null;

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        Tables not yet placed ({tables.length})
      </p>
      {tables.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          All tables are placed. Add more tables from the table list below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <div
              key={t._id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-table-id", t._id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="cursor-grab active:cursor-grabbing flex flex-col items-center justify-center w-20 h-20 rounded-xl shrink-0"
              style={{
                backgroundColor: "var(--muted)",
                border: "1px dashed var(--border-color)",
                borderRadius: t.shape === "circle" ? "50%" : 12,
              }}
              title="Drag onto the floor plan"
            >
              <span
                className="text-sm font-bold"
                style={{ color: "var(--fg)" }}
              >
                {t.name}
              </span>
              <span
                className="text-[10px] mt-0.5"
                style={{ color: "var(--muted-fg)" }}
              >
                {t.capacity} seat{t.capacity === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] mt-2" style={{ color: "var(--muted-fg)" }}>
        Drag a table onto the canvas to place it.
      </p>
    </div>
  );
}
