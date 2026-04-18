"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type Floor = {
  _id: Id<"floors">;
  name: string;
  width: number;
  height: number;
  backgroundUrl: string | null;
};

type FloorTabsProps = {
  floors: Floor[];
  activeFloorId: Id<"floors"> | null;
  onSelect: (id: Id<"floors">) => void;
  locationId: Id<"locations">;
  editMode: boolean;
};

export function FloorTabs({
  floors,
  activeFloorId,
  onSelect,
  locationId,
  editMode,
}: FloorTabsProps) {
  const { token } = useAuth();
  const createFloor = useMutation(api.floors.mutations.createFloor);
  const updateFloor = useMutation(api.floors.mutations.updateFloor);
  const deleteFloor = useMutation(api.floors.mutations.deleteFloor);
  const generateUploadUrl = useMutation(api.floors.mutations.generateUploadUrl);

  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"floors"> | null>(null);
  const [editingFloorId, setEditingFloorId] = useState<Id<"floors"> | null>(null);
  const [draftName, setDraftName] = useState("");

  const activeFloor = floors.find((f) => f._id === activeFloorId);

  useEffect(() => {
    if (editingFloorId && activeFloor) setDraftName(activeFloor.name);
  }, [editingFloorId, activeFloor]);

  const commitName = async () => {
    if (!token || !editingFloorId) return;
    await updateFloor({ token, floorId: editingFloorId, name: draftName });
    setEditingFloorId(null);
  };

  const handleAdd = async () => {
    if (!token) return;
    const id = await createFloor({
      token,
      locationId,
      name: `Floor ${floors.length + 1}`,
    });
    onSelect(id as Id<"floors">);
  };

  const handleResize = async (axis: "width" | "height", delta: number) => {
    if (!token || !activeFloor) return;
    const next = Math.max(400, Math.min(4000, activeFloor[axis] + delta));
    await updateFloor({ token, floorId: activeFloor._id, [axis]: next });
  };

  const handleUpload = async (file: File) => {
    if (!token || !activeFloor) return;
    const uploadUrl = await generateUploadUrl({ token });
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    await updateFloor({
      token,
      floorId: activeFloor._id,
      backgroundImageId: storageId,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {floors.map((floor) => (
          <button
            key={floor._id}
            onClick={() => onSelect(floor._id)}
            className="px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
            style={
              floor._id === activeFloorId
                ? { backgroundColor: "var(--accent-color)", color: "white" }
                : { backgroundColor: "var(--muted)", color: "var(--muted-fg)" }
            }
          >
            {floor.name}
          </button>
        ))}
        {editMode && (
          <button
            onClick={handleAdd}
            className="px-3 py-2 rounded-2xl text-xs font-semibold border border-dashed shrink-0"
            style={{ borderColor: "var(--border-color)", color: "var(--muted-fg)" }}
          >
            + New Floor
          </button>
        )}
      </div>

      {editMode && activeFloor && (
        <div
          className="flex items-center flex-wrap gap-3 p-3 rounded-2xl text-xs"
          style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}
        >
          {/* Name editor */}
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-widest">Name:</span>
            {editingFloorId === activeFloor._id ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditingFloorId(null);
                }}
                className="rounded-md px-2 py-1 text-xs"
                style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              />
            ) : (
              <button
                onClick={() => setEditingFloorId(activeFloor._id)}
                className="text-xs font-medium underline"
                style={{ color: "var(--fg)" }}
              >
                {activeFloor.name}
              </button>
            )}
          </div>

          {/* Canvas size */}
          <div className="flex items-center gap-1">
            <span className="font-semibold uppercase tracking-widest">Size:</span>
            <span className="font-mono">
              {activeFloor.width} × {activeFloor.height}
            </span>
            <button onClick={() => handleResize("width", -100)} className="px-1">−W</button>
            <button onClick={() => handleResize("width", 100)} className="px-1">+W</button>
            <button onClick={() => handleResize("height", -100)} className="px-1">−H</button>
            <button onClick={() => handleResize("height", 100)} className="px-1">+H</button>
          </div>

          {/* Background upload */}
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-widest">Background:</span>
            <label
              className="px-2 py-1 rounded-md cursor-pointer"
              style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            >
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
            {activeFloor.backgroundUrl && (
              <button
                onClick={async () => {
                  if (!token) return;
                  await updateFloor({
                    token,
                    floorId: activeFloor._id,
                    clearBackground: true,
                  });
                }}
                className="text-red-400"
              >
                Remove
              </button>
            )}
          </div>

          {/* Delete floor */}
          <button
            onClick={() => setConfirmDeleteId(activeFloor._id)}
            className="ml-auto text-red-400 font-medium"
          >
            Delete floor
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Delete this floor?"
        message="Tables on this floor will return to the unpositioned tray. Zones on this floor will be removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!token || !confirmDeleteId) return;
          const next = floors.find((f) => f._id !== confirmDeleteId);
          await deleteFloor({ token, floorId: confirmDeleteId });
          if (next) onSelect(next._id);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
