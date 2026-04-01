"use client";

import { useState, useCallback, useEffect } from"react";
import { useAction } from"convex/react";
import { api } from"../../convex/_generated/api";
import type { Id } from"../../convex/_generated/dataModel";

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

type VoidOrderDialogProps = {
 orderId: Id<"orders">;
 sessionToken: string;
 onClose: () => void;
 onVoided: (authorizerName: string) => void;
};

type Step ="pin" |"reason" |"success";

export function VoidOrderDialog({
 orderId,
 sessionToken,
 onClose,
 onVoided,
}: VoidOrderDialogProps) {
 const [step, setStep] = useState<Step>("pin");
 const [pin, setPin] = useState("");
 const [reason, setReason] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [shaking, setShaking] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [authorizerName, setAuthorizerName] = useState("");

 const voidOrder = useAction(api.orders.voidAction.voidOrder);

 // PIN entry handlers
 const handleDigit = (digit: string) => {
 if (pin.length >= MAX_PIN_LENGTH || isSubmitting) return;
 setError(null);
 setPin((prev) => prev + digit);
 };

 const handleBackspace = () => {
 if (isSubmitting) return;
 setError(null);
 setPin((prev) => prev.slice(0, -1));
 };

 const handleClear = () => {
 if (isSubmitting) return;
 setError(null);
 setPin("");
 };

 const handlePinComplete = useCallback(
 (currentPin: string) => {
 if (isSubmitting) return;
 // Store the PIN and move to reason step
 setPin(currentPin);
 setStep("reason");
 },
 [isSubmitting]
 );

 // Auto-advance to reason step when PIN length is reached
 useEffect(() => {
 if (
 pin.length >= MIN_PIN_LENGTH &&
 pin.length <= MAX_PIN_LENGTH &&
 step ==="pin" &&
 !isSubmitting
 ) {
 const timeout = setTimeout(() => {
 handlePinComplete(pin);
 }, 150);
 return () => clearTimeout(timeout);
 }
 }, [pin, handlePinComplete, isSubmitting, step]);

 // Keyboard support for PIN step
 useEffect(() => {
 if (step !=="pin") return;
 const handleKeyDown = (e: KeyboardEvent) => {
 if (isSubmitting) return;
 if (/^\d$/.test(e.key)) {
 handleDigit(e.key);
 } else if (e.key ==="Backspace") {
 handleBackspace();
 } else if (e.key ==="Escape") {
 onClose();
 }
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [step, isSubmitting, pin]);

 const handleSubmitVoid = async () => {
 if (!reason.trim()) {
 setError("Please enter a reason for voiding this order.");
 return;
 }
 setIsSubmitting(true);
 setError(null);

 try {
 const result = await voidOrder({
 token: sessionToken,
 orderId,
 authorizerPin: pin,
 voidReason: reason.trim(),
 });
 setAuthorizerName(result.authorizerName);
 setStep("success");
 setTimeout(() => {
 onVoided(result.authorizerName);
 }, 1500);
 } catch (err: unknown) {
 const message =
 err instanceof Error ? err.message :"Void failed. Try again.";
 // If PIN was wrong, go back to PIN step
 if (message.includes("Invalid authorization PIN")) {
 setStep("pin");
 setPin("");
 setShaking(true);
 setError("Invalid manager/owner PIN. Try again.");
 setTimeout(() => setShaking(false), 500);
 } else {
 setError(message);
 }
 } finally {
 setIsSubmitting(false);
 }
 };

 // Success view
 if (step ==="success") {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
 <div className="flex flex-col items-center rounded-2xl bg-neutral-900 p-8 text-white shadow-2xl">
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
 <p className="text-xl font-semibold">Order Voided</p>
 <p className="text-neutral-400 mt-1">
 Authorized by {authorizerName}
 </p>
 </div>
 </div>
 );
 }

 // Reason step
 if (step ==="reason") {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
 <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-6 text-white shadow-2xl">
 <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Void Order</h2>
 <p className="text-neutral-400 mb-6">
 Enter the reason for voiding this order.
 </p>

 <label htmlFor="void-reason" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-fg)' }}>
 Void Reason <span className="text-red-400">*</span>
 </label>
 <textarea
 id="void-reason"
 className="w-full rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 rows={3}
 placeholder="e.g. Customer changed their mind, Wrong order..."
 value={reason}
 onChange={(e) => {
 setReason(e.target.value);
 setError(null);
 }}
 autoFocus
 disabled={isSubmitting}
 />

 {error && (
 <p className="mt-2 text-sm text-red-400">{error}</p>
 )}

 <div className="mt-6 flex gap-3">
 <button
 type="button"
 className="flex-1 rounded-2xl bg-neutral-700 px-4 py-3 text-base font-semibold hover:bg-neutral-600 active:bg-neutral-500 transition-colors min-h-[48px]"
 onClick={() => {
 setStep("pin");
 setPin("");
 setError(null);
 }}
 disabled={isSubmitting}
 >
 Back
 </button>
 <button
 type="button"
 className="flex-1 rounded-2xl bg-red-700 px-4 py-3 text-base font-semibold hover:bg-red-600 active:bg-red-500 transition-colors min-h-[48px] disabled:opacity-50"
 onClick={handleSubmitVoid}
 disabled={isSubmitting}
 >
 {isSubmitting ?"Voiding..." :"Void Order"}
 </button>
 </div>
 </div>
 </div>
 );
 }

 // PIN step (default)
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
 <div className="flex flex-col items-center rounded-2xl bg-neutral-900 p-8 text-white shadow-2xl">
 <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Void Order</h2>
 <p className="text-neutral-400 mb-6">Manager/Owner PIN required</p>

 {/* PIN dots */}
 <div
 className={`flex gap-3 mb-2 ${shaking ?"animate-shake" :""}`}
 aria-live="polite"
 aria-label={`${pin.length} of up to ${MAX_PIN_LENGTH} digits entered`}
 >
 {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
 <div
 key={i}
 className={`h-4 w-4 rounded-full border-2 border-white transition-colors ${
 i < pin.length ?"bg-white" :"bg-transparent"
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
 {["1","2","3","4","5","6","7","8","9"].map((digit) => (
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

 {/* Cancel button */}
 <button
 type="button"
 className="mt-6 text-neutral-400 hover:text-white text-sm underline"
 onClick={onClose}
 disabled={isSubmitting}
 >
 Cancel
 </button>
 </div>
 </div>
 );
}
