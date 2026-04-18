"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

const GRID = 10;

type FloorPlan = {
  floor: {
    _id: Id<"floors">;
    name: string;
    width: number;
    height: number;
    backgroundUrl: string | null;
  };
  tables: Array<{
    _id: Id<"tables">;
    name: string;
    capacity: number;
    shape: "rectangle" | "circle";
    xPos: number;
    yPos: number;
    width: number;
    height: number;
    rotation: number;
    occupied: boolean;
  }>;
  zones: Array<{
    _id: Id<"tableZones">;
    name: string;
    color: string;
    xPos: number;
    yPos: number;
    width: number;
    height: number;
    rotation: number;
  }>;
};

type FloorPlanCanvasProps = {
  floorId: Id<"floors">;
  editMode: boolean;
};

const ZONE_COLORS = [
  "#fde68a", // amber
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fbcfe8", // pink
  "#ddd6fe", // purple
  "#fed7aa", // orange
];

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

export function FloorPlanCanvas({ floorId, editMode }: FloorPlanCanvasProps) {
  const { token } = useAuth();
  const data = useQuery(
    api.floors.queries.getFloorPlan,
    token ? { token, floorId } : "skip"
  ) as FloorPlan | undefined;

  const placeTable = useMutation(api.floors.mutations.placeTable);
  const removeFromFloor = useMutation(api.floors.mutations.removeTableFromFloor);
  const updateZone = useMutation(api.floors.mutations.updateZone);
  const deleteZone = useMutation(api.floors.mutations.deleteZone);
  const createZone = useMutation(api.floors.mutations.createZone);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drop-target state for tray drops
  const [isDropTarget, setIsDropTarget] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!editMode || !selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!data) return;
        const zone = data.zones.find((z) => z._id === selectedId);
        const table = data.tables.find((t) => t._id === selectedId);
        if (zone && token) {
          deleteZone({ token, zoneId: zone._id });
          setSelectedId(null);
        } else if (table && token) {
          removeFromFloor({ token, tableId: table._id });
          setSelectedId(null);
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [editMode, selectedId, data, token, deleteZone, removeFromFloor]);

  if (!data) {
    return (
      <div
        className="flex items-center justify-center h-96 rounded-2xl"
        style={{ backgroundColor: "var(--muted)", border: "1px dashed var(--border-color)" }}
      >
        <p style={{ color: "var(--muted-fg)" }}>Loading floor plan…</p>
      </div>
    );
  }

  const { floor, tables, zones } = data;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
    const tableId = e.dataTransfer.getData("application/x-table-id") as Id<"tables">;
    if (!tableId || !token) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = snap(Math.max(0, e.clientX - rect.left - 40));
    const y = snap(Math.max(0, e.clientY - rect.top - 40));
    await placeTable({
      token,
      tableId,
      floorId,
      xPos: x,
      yPos: y,
      width: 80,
      height: 80,
      shape: "rectangle",
      rotation: 0,
    });
  };

  const handleAddZone = async () => {
    if (!token) return;
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    await createZone({
      token,
      floorId,
      name: `Zone ${zones.length + 1}`,
      color,
      xPos: snap(40),
      yPos: snap(40),
      width: 240,
      height: 160,
    });
  };

  return (
    <div className="space-y-3">
      {editMode && (
        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--muted-fg)" }}>
          <button
            onClick={handleAddZone}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            + Add Zone
          </button>
          <span>Tap to select. Drag corners to resize. Press Delete to remove.</span>
        </div>
      )}

      <div
        ref={containerRef}
        onDragOver={(e) => {
          if (editMode) {
            e.preventDefault();
            setIsDropTarget(true);
          }
        }}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={handleDrop}
        onClick={(e) => {
          // Click on empty canvas → deselect
          if (e.target === containerRef.current) setSelectedId(null);
        }}
        className="relative overflow-auto rounded-2xl select-none touch-none"
        style={{
          backgroundColor: "var(--muted)",
          backgroundImage: floor.backgroundUrl ? `url(${floor.backgroundUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: isDropTarget ? "2px dashed var(--accent-color)" : "1px solid var(--border-color)",
          width: "100%",
          maxWidth: floor.width,
          aspectRatio: `${floor.width} / ${floor.height}`,
          position: "relative",
        }}
      >
        {/* Grid overlay (only in edit mode) */}
        {editMode && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.3) 1px, transparent 1px)",
              backgroundSize: `${GRID}px ${GRID}px`,
            }}
          />
        )}

        {/* Zones — render BEHIND tables */}
        {zones.map((zone) => (
          <ZoneShape
            key={zone._id}
            zone={zone}
            editMode={editMode}
            selected={selectedId === zone._id}
            onSelect={() => setSelectedId(zone._id)}
            bounds={containerRef.current ?? undefined}
            onChange={async (patch) => {
              if (!token) return;
              await updateZone({ token, zoneId: zone._id, ...patch });
            }}
          />
        ))}

        {/* Tables */}
        {tables.map((table) => (
          <TableShape
            key={table._id}
            table={table}
            editMode={editMode}
            selected={selectedId === table._id}
            onSelect={() => setSelectedId(table._id)}
            bounds={containerRef.current ?? undefined}
            onChange={async (patch) => {
              if (!token) return;
              await placeTable({
                token,
                tableId: table._id,
                floorId,
                ...patch,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type ZoneShapeProps = {
  zone: FloorPlan["zones"][number];
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
  bounds: HTMLElement | undefined;
  onChange: (patch: { xPos?: number; yPos?: number; width?: number; height?: number }) => void;
};

function ZoneShape({ zone, editMode, selected, onSelect, bounds, onChange }: ZoneShapeProps) {
  if (!editMode) {
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: zone.xPos,
          top: zone.yPos,
          width: zone.width,
          height: zone.height,
          backgroundColor: zone.color,
          opacity: 0.4,
          borderRadius: 16,
          border: "2px dashed rgba(0,0,0,0.15)",
        }}
      >
        <span
          className="absolute top-2 left-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "rgba(0,0,0,0.5)" }}
        >
          {zone.name}
        </span>
      </div>
    );
  }

  return (
    <Rnd
      bounds={bounds ?? "parent"}
      size={{ width: zone.width, height: zone.height }}
      position={{ x: zone.xPos, y: zone.yPos }}
      dragGrid={[GRID, GRID]}
      resizeGrid={[GRID, GRID]}
      onDragStop={(_, d) => {
        onChange({ xPos: snap(d.x), yPos: snap(d.y) });
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        onChange({
          width: snap(parseInt(ref.style.width, 10)),
          height: snap(parseInt(ref.style.height, 10)),
          xPos: snap(position.x),
          yPos: snap(position.y),
        });
      }}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      style={{
        backgroundColor: zone.color,
        opacity: 0.55,
        borderRadius: 16,
        border: selected
          ? "2px solid var(--accent-color)"
          : "2px dashed rgba(0,0,0,0.2)",
      }}
      resizeHandleStyles={selected ? handleStyles : { ...handleStyles, opacity: 0 } as Record<string, React.CSSProperties>}
    >
      <span
        className="absolute top-2 left-3 text-xs font-semibold uppercase tracking-widest pointer-events-none"
        style={{ color: "rgba(0,0,0,0.6)" }}
      >
        {zone.name}
      </span>
    </Rnd>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type TableShapeProps = {
  table: FloorPlan["tables"][number];
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
  bounds: HTMLElement | undefined;
  onChange: (patch: {
    xPos?: number;
    yPos?: number;
    width?: number;
    height?: number;
    rotation?: number;
    shape?: "rectangle" | "circle";
  }) => void;
};

function TableShape({ table, editMode, selected, onSelect, bounds, onChange }: TableShapeProps) {
  const isCircle = table.shape === "circle";
  const baseColor = table.occupied ? "#fde68a" : "#ffffff";
  const borderColor = table.occupied ? "#d97706" : "rgba(0,0,0,0.25)";

  const inner = (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center select-none pointer-events-none"
      style={{
        backgroundColor: baseColor,
        border: `2px solid ${selected ? "var(--accent-color)" : borderColor}`,
        borderRadius: isCircle ? "50%" : 12,
        transform: `rotate(${table.rotation}deg)`,
        transformOrigin: "center",
        color: "#1c1917",
      }}
    >
      <span className="text-sm font-bold leading-none">{table.name}</span>
      <span className="text-[10px] opacity-60 mt-1">{table.capacity} seat{table.capacity === 1 ? "" : "s"}</span>
    </div>
  );

  if (!editMode) {
    return (
      <div
        className="absolute"
        style={{
          left: table.xPos,
          top: table.yPos,
          width: table.width,
          height: table.height,
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Rnd
      bounds={bounds ?? "parent"}
      size={{ width: table.width, height: table.height }}
      position={{ x: table.xPos, y: table.yPos }}
      dragGrid={[GRID, GRID]}
      resizeGrid={[GRID, GRID]}
      minWidth={48}
      minHeight={48}
      onDragStop={(_, d) => onChange({ xPos: snap(d.x), yPos: snap(d.y) })}
      onResizeStop={(_, __, ref, ___, position) => {
        onChange({
          width: snap(parseInt(ref.style.width, 10)),
          height: snap(parseInt(ref.style.height, 10)),
          xPos: snap(position.x),
          yPos: snap(position.y),
        });
      }}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      style={{ zIndex: selected ? 20 : 10 }}
      resizeHandleStyles={selected ? handleStyles : { ...handleStyles, opacity: 0 } as Record<string, React.CSSProperties>}
    >
      {inner}

      {/* Selected toolbar — sits above the table */}
      {selected && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 rounded-xl px-2 py-1 shadow-lg whitespace-nowrap"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onChange({ shape: isCircle ? "rectangle" : "circle" })}
            className="px-2 py-1 text-xs font-medium rounded-lg"
            title="Toggle shape"
            style={{ color: "var(--fg)" }}
          >
            {isCircle ? "■" : "●"}
          </button>
          <button
            onClick={() => onChange({ rotation: (table.rotation - 15 + 360) % 360 })}
            className="px-2 py-1 text-xs font-medium rounded-lg"
            title="Rotate left"
            style={{ color: "var(--fg)" }}
          >
            ⟲
          </button>
          <button
            onClick={() => onChange({ rotation: (table.rotation + 15) % 360 })}
            className="px-2 py-1 text-xs font-medium rounded-lg"
            title="Rotate right"
            style={{ color: "var(--fg)" }}
          >
            ⟳
          </button>
        </div>
      )}
    </Rnd>
  );
}

// Tablet-friendly resize handles (24px touch target)
const handleStyles: Record<string, React.CSSProperties> = {
  top: handle("ns", "top"),
  bottom: handle("ns", "bottom"),
  left: handle("ew", "left"),
  right: handle("ew", "right"),
  topLeft: corner("nwse", { top: -8, left: -8 }),
  topRight: corner("nesw", { top: -8, right: -8 }),
  bottomLeft: corner("nesw", { bottom: -8, left: -8 }),
  bottomRight: corner("nwse", { bottom: -8, right: -8 }),
};

function handle(cursor: string, side: "top" | "bottom" | "left" | "right"): React.CSSProperties {
  const horizontal = side === "left" || side === "right";
  return {
    backgroundColor: "rgba(245, 158, 11, 0.9)",
    cursor: cursor + "-resize",
    width: horizontal ? 8 : 24,
    height: horizontal ? 24 : 8,
    borderRadius: 4,
    [side]: -4,
    ...(horizontal ? { top: "50%", marginTop: -12 } : { left: "50%", marginLeft: -12 }),
  };
}

function corner(cursor: string, pos: React.CSSProperties): React.CSSProperties {
  return {
    backgroundColor: "rgba(245, 158, 11, 0.9)",
    cursor: cursor + "-resize",
    width: 16,
    height: 16,
    borderRadius: 4,
    ...pos,
  };
}
