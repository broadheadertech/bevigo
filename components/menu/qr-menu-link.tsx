"use client";

import { useState } from "react";

type QrMenuLinkProps = {
  locationSlug: string;
  locationName: string;
};

export function QrMenuLink({ locationSlug, locationName }: QrMenuLinkProps) {
  const [copied, setCopied] = useState(false);

  const menuPath = `/menu/${locationSlug}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${origin}${menuPath}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = fullUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate a QR code URL using a public API (no library needed)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="font-semibold text-stone-900">
        Customer QR Menu - {locationName}
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        Customers can scan this QR code or visit the link to view the menu on
        their phone.
      </p>

      {/* QR Code Image */}
      <div className="mt-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {origin && (
          <img
            src={qrCodeUrl}
            alt={`QR code for ${locationName} menu`}
            width={200}
            height={200}
            className="rounded border border-stone-100"
          />
        )}
      </div>

      {/* URL Display */}
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {fullUrl || menuPath}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-xs text-stone-400">
        Print this QR code and place it at your location for customers to scan.
      </p>
    </div>
  );
}
