"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CameraCapture, CameraCaptureHandle } from "./camera-capture";
import { detectFaceDescriptor, loadFaceApiModels } from "@/lib/face-recognition";

type Props = {
  token: string;
  userId: Id<"users">;
};

export function ReferencePhotoUploader({ token, userId }: Props) {
  const referencePhotoUrl = useQuery(api.staff.photoMutations.getUserReferencePhotoUrl, {
    token,
    userId,
  });
  const generateUploadUrl = useMutation(
    api.staff.photoMutations.generateReferencePhotoUploadUrl
  );
  const setReferencePhoto = useMutation(api.staff.photoMutations.setReferencePhoto);
  const removeReferencePhoto = useMutation(api.staff.photoMutations.removeReferencePhoto);

  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraCaptureHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processBlob = async (
    blob: Blob,
    sourceElement: HTMLVideoElement | HTMLImageElement
  ) => {
    setError(null);
    setBusy(true);
    try {
      await loadFaceApiModels();
      const descriptor = await detectFaceDescriptor(sourceElement);
      if (!descriptor) {
        setError("No face detected. Try again with a clearer photo.");
        return;
      }
      const uploadUrl = await generateUploadUrl({ token });
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
      await setReferencePhoto({
        token,
        userId,
        photoId: storageId,
        faceDescriptor: Array.from(descriptor),
      });
      setMode("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save photo");
    } finally {
      setBusy(false);
    }
  };

  const handleCameraCapture = async () => {
    const result = await cameraRef.current?.capture();
    if (!result) {
      setError("Could not capture from camera");
      return;
    }
    await processBlob(result.blob, result.video);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    await processBlob(file, img);
    URL.revokeObjectURL(img.src);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeReferencePhoto({ token, userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        Reference Photo (Face Match)
      </label>

      <div className="flex items-start gap-3">
        {referencePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referencePhotoUrl}
            alt="Reference"
            className="w-20 h-20 rounded-2xl object-cover"
            style={{ border: "1px solid var(--border-color)" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-xs"
            style={{
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border-color)",
              color: "var(--muted-fg)",
            }}
          >
            No photo
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1">
          {mode === "idle" && (
            <>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMode("camera")}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl text-xs font-medium"
                  style={{
                    border: "1px solid var(--border-color)",
                    color: "var(--fg)",
                  }}
                >
                  Use Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl text-xs font-medium"
                  style={{
                    border: "1px solid var(--border-color)",
                    color: "var(--fg)",
                  }}
                >
                  Upload File
                </button>
                {referencePhotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-red-400"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {mode === "camera" && (
        <div className="mt-3 space-y-2">
          <CameraCapture ref={cameraRef} active={true} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCameraCapture}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {busy ? "Processing..." : "Capture"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {busy && mode === "idle" && (
        <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
          Processing...
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
