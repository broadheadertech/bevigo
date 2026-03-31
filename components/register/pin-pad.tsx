"use client";

import { useState, useCallback, useEffect } from "react";

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

type PinSwitchResult =
  | { success: true; token: string; userName: string; role: string }
  | { success: false; locked: true; requireFullLogin: true }
  | { success: false; locked: false; attemptsRemaining: number };

type PinPadProps = {
  locationId: string;
  locationName: string;
  sessionToken: string;
  onSuccess: (result: {
    token: string;
    userName: string;
    role: string;
  }) => void;
  onRequireFullLogin: () => void;
  onPinSubmit: (args: {
    token: string;
    locationId: string;
    pin: string;
  }) => Promise<PinSwitchResult>;
};

export function PinPad({
  locationName,
  locationId,
  sessionToken,
  onSuccess,
  onRequireFullLogin,
  onPinSubmit,
}: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [switchedUser, setSwitchedUser] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (currentPin: string) => {
      if (isSubmitting || locked) return;
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await onPinSubmit({
          token: sessionToken,
          locationId,
          pin: currentPin,
        });

        if (result.success) {
          setSwitchedUser(result.userName);
          // Brief delay to show the user name before closing
          setTimeout(() => {
            onSuccess({
              token: result.token,
              userName: result.userName,
              role: result.role,
            });
          }, 800);
        } else if (result.locked) {
          setLocked(true);
          setPin("");
          onRequireFullLogin();
        } else {
          // Wrong PIN — shake and clear
          setShaking(true);
          setError(
            `Incorrect PIN. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? "s" : ""} remaining.`
          );
          setTimeout(() => {
            setShaking(false);
            setPin("");
          }, 500);
        }
      } catch {
        setError("Something went wrong. Try again.");
        setPin("");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      locked,
      onPinSubmit,
      sessionToken,
      locationId,
      onSuccess,
      onRequireFullLogin,
    ]
  );

  // Auto-submit at each valid PIN length (4, 5, 6)
  useEffect(() => {
    if (
      pin.length >= MIN_PIN_LENGTH &&
      pin.length <= MAX_PIN_LENGTH &&
      !isSubmitting
    ) {
      const timeout = setTimeout(() => {
        handleSubmit(pin);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [pin, handleSubmit, isSubmitting]);

  const handleDigit = (digit: string) => {
    if (pin.length >= MAX_PIN_LENGTH || isSubmitting || locked) return;
    setError(null);
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (isSubmitting || locked) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isSubmitting || locked) return;
    setError(null);
    setPin("");
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (locked || isSubmitting) return;
      if (/^\d$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, isSubmitting, pin]);

  if (switchedUser) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 mb-4">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-xl font-semibold">Welcome, {switchedUser}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white">
        <h1 className="text-2xl font-bold mb-2">bevi&amp;go</h1>
        <p className="text-neutral-400 mb-6">{locationName}</p>
        <p className="text-red-400 text-lg mb-8">
          Too many failed attempts. Please sign in with Google.
        </p>
        <a
          href="/login"
          className="rounded-lg bg-white px-6 py-3 text-lg font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          Switch to full login
        </a>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white"
      role="dialog"
      aria-label="Enter PIN"
    >
      <h1 className="text-2xl font-bold mb-2">bevi&amp;go</h1>
      <p className="text-neutral-400 mb-8">{locationName}</p>
      <p className="text-lg mb-6">Enter your PIN</p>

      {/* PIN dots */}
      <div
        className={`flex gap-3 mb-2 ${shaking ? "animate-shake" : ""}`}
        aria-live="polite"
        aria-label={`${pin.length} of up to ${MAX_PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-white transition-colors ${
              i < pin.length ? "bg-white" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      <div className="h-6 mt-2 mb-6">
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {/* Numpad */}
      <div
        className="grid grid-cols-3 gap-3"
        role="group"
        aria-label="PIN keypad"
      >
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-neutral-800 text-2xl font-semibold hover:bg-neutral-700 active:bg-neutral-600 transition-colors"
            onClick={() => handleDigit(digit)}
            disabled={isSubmitting}
            aria-label={digit}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-neutral-800 text-xl hover:bg-neutral-700 active:bg-neutral-600 transition-colors"
          onClick={handleBackspace}
          disabled={isSubmitting}
          aria-label="Backspace"
        >
          &#9003;
        </button>
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-neutral-800 text-2xl font-semibold hover:bg-neutral-700 active:bg-neutral-600 transition-colors"
          onClick={() => handleDigit("0")}
          disabled={isSubmitting}
          aria-label="0"
        >
          0
        </button>
        <button
          type="button"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-neutral-800 text-xl hover:bg-neutral-700 active:bg-neutral-600 transition-colors"
          onClick={handleClear}
          disabled={isSubmitting}
          aria-label="Clear"
        >
          C
        </button>
      </div>

      {/* Loading indicator */}
      {isSubmitting && (
        <p className="mt-4 text-neutral-400 text-sm">Verifying...</p>
      )}

      {/* Full login link */}
      <a
        href="/login"
        className="mt-8 text-neutral-400 hover:text-white text-sm underline"
      >
        Switch to full login
      </a>
    </div>
  );
}
