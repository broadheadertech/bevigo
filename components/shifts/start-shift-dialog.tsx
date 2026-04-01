"use client";

import { useState } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type StartShiftDialogProps = {
 locationId: Id<"locations">;
 onClose: () => void;
 onStarted: () => void;
};

export function StartShiftDialog({
 locationId,
 onClose,
 onStarted,
}: StartShiftDialogProps) {
 const { token } = useAuth();
 const startShift = useMutation(api.shifts.mutations.startShift);
 const [cashAmount, setCashAmount] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token) return;

 const cents = Math.round(parseFloat(cashAmount ||"0") * 100);
 if (isNaN(cents) || cents < 0) {
 setError("Please enter a valid cash amount");
 return;
 }

 setIsSubmitting(true);
 setError(null);

 try {
 await startShift({ token, locationId, openingCash: cents });
 onStarted();
 } catch (err: unknown) {
 const message =
 err instanceof Error ? err.message :"Failed to start shift";
 setError(message);
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="rounded-2xl border shadow-lg w-full max-w-md p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>
 Start Shift
 </h2>
 <form onSubmit={handleSubmit}>
 <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Opening Cash Amount
 </label>
 <div className="relative mb-4">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">
 $
 </span>
 <input
 type="number"
 step="0.01"
 min="0"
 value={cashAmount}
 onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
 setCashAmount(e.target.value)
 }
 placeholder="0.00"
 className="w-full pl-7 pr-3 py-2.5 rounded-xl focus:ring-amber-500/20 focus:border-amber-500 text-sm outline-none"
 autoFocus
 />
 </div>

 {error && (
 <p className="text-red-600 text-sm mb-3">{error}</p>
 )}

 <div className="flex gap-3 justify-end">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting}
 className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
 >
 {isSubmitting ?"Starting..." :"Start Shift"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
