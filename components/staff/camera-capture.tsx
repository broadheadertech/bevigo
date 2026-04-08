"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

export type CameraCaptureHandle = {
  capture: () => Promise<{ blob: Blob; dataUrl: string; video: HTMLVideoElement } | null>;
};

type Props = {
  active: boolean;
};

export const CameraCapture = forwardRef<CameraCaptureHandle, Props>(function CameraCapture(
  { active },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera access denied");
      }
    };

    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [active]);

  useImperativeHandle(
    ref,
    () => ({
      capture: async () => {
        if (!videoRef.current || !ready) return null;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
        );
        if (!blob) return null;
        return { blob, dataUrl, video };
      },
    }),
    [ready]
  );

  if (error) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
      >
        <p className="text-sm text-red-400 mb-2">Camera unavailable</p>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-auto"
        style={{ transform: "scaleX(-1)" }}
      />
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: "var(--card)" }}
        >
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Starting camera...
          </p>
        </div>
      )}
    </div>
  );
});
