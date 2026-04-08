"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { CameraCapture, CameraCaptureHandle } from "@/components/staff/camera-capture";
import {
  detectFaceDescriptor,
  findBestMatch,
  loadFaceApiModels,
} from "@/lib/face-recognition";

const MIN_PIN = 4;
const MAX_PIN = 6;

export default function StaffClockPage() {
  const { token, session } = useAuth();
  const pinClock = useAction(api.timesheets.pinClockAction.pinClock);
  const generateUploadUrl = useMutation(
    api.timesheets.photoMutations.generatePhotoUploadUrl
  );

  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState<{
    userName: string;
    action: "clocked_in" | "clocked_out";
    workMinutes?: number;
    earnedAmount?: number;
    faceMatch?: number;
  } | null>(null);

  const cameraRef = useRef<CameraCaptureHandle>(null);
  const locationId = session?.locationIds?.[0] as Id<"locations"> | undefined;

  const faceDescriptors = useQuery(
    api.staff.photoMutations.getLocationFaceDescriptors,
    token && locationId ? { token, locationId } : "skip"
  );

  // Preload face-api models in background
  useEffect(() => {
    void loadFaceApiModels().catch(() => {
      // ignore — first capture will retry
    });
  }, []);

  const handleSubmit = useCallback(
    async (currentPin: string) => {
      if (!token || !locationId || isSubmitting) return;
      setIsSubmitting(true);
      setError(null);
      try {
        // 1. Capture photo
        let photoId: Id<"_storage"> | undefined;
        let faceMatchConfidence: number | undefined;

        const captured = await cameraRef.current?.capture();
        if (captured) {
          // 2. Try face detection + matching (best effort)
          try {
            const descriptor = await detectFaceDescriptor(captured.video);
            if (descriptor && faceDescriptors && faceDescriptors.length > 0) {
              const best = findBestMatch(descriptor, faceDescriptors);
              if (best) faceMatchConfidence = best.confidence;
            }
          } catch {
            // ignore face detection errors — still upload photo
          }

          // 3. Upload photo
          try {
            const uploadUrl = await generateUploadUrl({});
            const res = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": captured.blob.type },
              body: captured.blob,
            });
            if (res.ok) {
              const json = (await res.json()) as { storageId: Id<"_storage"> };
              photoId = json.storageId;
            }
          } catch {
            // ignore upload errors — still try to clock in
          }
        }

        const result = await pinClock({
          token,
          locationId,
          pin: currentPin,
          photoId,
          faceMatch: faceMatchConfidence,
        });
        setSuccess({
          userName: result.userName,
          action: result.action,
          workMinutes: "workMinutes" in result ? result.workMinutes : undefined,
          earnedAmount: "earnedAmount" in result ? result.earnedAmount : undefined,
          faceMatch: faceMatchConfidence,
        });
        setPin("");
        setTimeout(() => setSuccess(null), 4000);
      } catch (err) {
        setShaking(true);
        setError(err instanceof Error ? err.message : "Invalid PIN");
        setPin("");
        setTimeout(() => setShaking(false), 500);
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, locationId, isSubmitting, pinClock, generateUploadUrl, faceDescriptors]
  );

  const handleDigit = (digit: string) => {
    if (pin.length >= MAX_PIN || isSubmitting) return;
    setError(null);
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  // Auto-submit at 6 digits
  useEffect(() => {
    if (pin.length === MAX_PIN && !isSubmitting) {
      const t = setTimeout(() => handleSubmit(pin), 150);
      return () => clearTimeout(t);
    }
  }, [pin, isSubmitting, handleSubmit]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isSubmitting) return;
      if (/^\d$/.test(e.key)) handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
      else if (e.key === "Escape") handleClear();
      else if (e.key === "Enter" && pin.length >= MIN_PIN) handleSubmit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, isSubmitting]);

  if (!token || !session || !locationId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  if (success) {
    const hours = success.workMinutes ? Math.floor(success.workMinutes / 60) : 0;
    const mins = success.workMinutes ? success.workMinutes % 60 : 0;
    const matchPct =
      success.faceMatch !== undefined ? Math.round(success.faceMatch * 100) : null;
    const matchColor =
      success.faceMatch === undefined
        ? "var(--muted-fg)"
        : success.faceMatch >= 0.7
          ? "#22c55e"
          : success.faceMatch >= 0.5
            ? "#f59e0b"
            : "#ef4444";

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div
          className="rounded-3xl shadow-2xl px-12 py-10 text-center max-w-md w-full"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6"
            style={{
              backgroundColor:
                success.action === "clocked_in"
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(217,119,6,0.15)",
            }}
          >
            <svg
              className="w-10 h-10"
              style={{
                color:
                  success.action === "clocked_in" ? "#22c55e" : "var(--accent-color)",
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--fg)" }}>
            {success.action === "clocked_in" ? "Clocked In" : "Clocked Out"}
          </h2>
          <p className="text-lg mb-1" style={{ color: "var(--muted-fg)" }}>
            Welcome, {success.userName}
          </p>
          {matchPct !== null && (
            <p className="text-sm mt-1" style={{ color: matchColor }}>
              Face match: {matchPct}%
            </p>
          )}
          {success.action === "clocked_out" && success.workMinutes !== undefined && (
            <div
              className="mt-6 pt-6 space-y-2"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                Worked
              </p>
              <p className="text-3xl font-bold" style={{ color: "var(--fg)" }}>
                {hours}h {mins}m
              </p>
              {(success.earnedAmount ?? 0) > 0 && (
                <p
                  className="text-lg font-semibold"
                  style={{ color: "var(--accent-color)" }}
                >
                  Earned {formatCurrency(success.earnedAmount ?? 0)}
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => setSuccess(null)}
            className="mt-6 px-6 py-2.5 rounded-2xl text-sm font-medium"
            style={{
              border: "1px solid var(--border-color)",
              color: "var(--fg)",
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[70vh] py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
          Staff Clock In/Out
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
          Enter your Quick-PIN to clock in or out
        </p>
      </div>

      {/* Camera preview */}
      <div className="w-full max-w-xs mb-4">
        <CameraCapture ref={cameraRef} active={true} />
      </div>

      {/* PIN dots */}
      <div
        className={`flex gap-3 mb-4 ${shaking ? "animate-shake" : ""}`}
        aria-label={`${pin.length} of up to ${MAX_PIN} digits entered`}
      >
        {Array.from({ length: MAX_PIN }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-4 rounded-full border-2 transition-colors"
            style={{
              borderColor: "var(--fg)",
              backgroundColor: i < pin.length ? "var(--fg)" : "transparent",
            }}
          />
        ))}
      </div>

      <div className="h-6 mb-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3" role="group" aria-label="PIN keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl text-2xl font-semibold transition-colors active:scale-95"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
            onClick={() => handleDigit(digit)}
            disabled={isSubmitting}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl text-xl transition-colors"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
          onClick={handleBackspace}
          disabled={isSubmitting}
        >
          &#9003;
        </button>
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl text-2xl font-semibold transition-colors active:scale-95"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
          onClick={() => handleDigit("0")}
          disabled={isSubmitting}
        >
          0
        </button>
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl text-xl transition-colors"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
          onClick={handleClear}
          disabled={isSubmitting}
        >
          C
        </button>
      </div>

      <button
        type="button"
        className="mt-6 w-full max-w-[232px] py-3 rounded-2xl text-sm font-bold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30"
        style={{
          backgroundColor: pin.length >= MIN_PIN ? "var(--accent-color)" : "var(--muted)",
          color: "white",
        }}
        onClick={() => {
          if (pin.length >= MIN_PIN) handleSubmit(pin);
        }}
        disabled={pin.length < MIN_PIN || isSubmitting}
      >
        {isSubmitting ? "Verifying..." : "Clock In / Out"}
      </button>
    </div>
  );
}
