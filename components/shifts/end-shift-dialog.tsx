"use client";

import { useState } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type EndShiftDialogProps = {
 shiftId: Id<"shifts">;
 startedAt: number;
 openingCash: number;
 onClose: () => void;
 onEnded: () => void;
};

function formatDuration(ms: number): string {
 const hours = Math.floor(ms / 3600000);
 const minutes = Math.floor((ms % 3600000) / 60000);
 return `${hours}h ${minutes}m`;
}

function formatCurrency(cents: number): string {
 return `$${(cents / 100).toFixed(2)}`;
}

export function EndShiftDialog({
 shiftId,
 startedAt,
 openingCash,
 onClose,
 onEnded,
}: EndShiftDialogProps) {
 const { token } = useAuth();
 const endShift = useMutation(api.shifts.mutations.endShift);
 const [cashAmount, setCashAmount] = useState("");
 const [notes, setNotes] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [result, setResult] = useState<{
 expectedCash: number;
 variance: number;
 } | null>(null);

 const [mountTime] = useState(() => Date.now());
 const duration = mountTime - startedAt;

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
 const res = await endShift({
 token,
 shiftId,
 closingCash: cents,
 notes: notes || undefined,
 });
 setResult(res);
 // Auto-close after a brief delay to show variance
 setTimeout(() => onEnded(), 2000);
 } catch (err: unknown) {
 const message =
 err instanceof Error ? err.message :"Failed to end shift";
 setError(message);
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="rounded-2xl border shadow-lg w-full max-w-md p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>
 End Shift
 </h2>

 {/* Shift summary */}
 <div className="rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: 'var(--muted)' }}>
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>Started</span>
 <span className="text-stone-900 font-medium">
 {new Date(startedAt).toLocaleTimeString()}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>Duration</span>
 <span className="text-stone-900 font-medium">
 {formatDuration(duration)}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>Opening Cash</span>
 <span className="text-stone-900 font-medium">
 {formatCurrency(openingCash)}
 </span>
 </div>
 </div>

 {result ? (
 <div className="space-y-3">
 <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--muted)' }}>
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>Expected Cash</span>
 <span className="text-stone-900 font-medium">
 {formatCurrency(result.expectedCash)}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>Variance</span>
 <span
 className={`font-medium ${
 result.variance === 0
 ?"text-green-600"
 : Math.abs(result.variance) <= 500
 ?"text-amber-600"
 :"text-red-600"
 }`}
 >
 {result.variance >= 0 ?"+" :""}
 {formatCurrency(result.variance)}
 </span>
 </div>
 </div>
 <p className="text-sm text-center">
 Shift ended successfully
 </p>
 </div>
 ) : (
 <form onSubmit={handleSubmit}>
 <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Closing Cash Amount
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

 <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Notes (optional)
 </label>
 <textarea
 value={notes}
 onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
 setNotes(e.target.value)
 }
 placeholder="Any notes about this shift..."
 rows={2}
 className="w-full px-3 py-2.5 rounded-xl focus:ring-amber-500/20 focus:border-amber-500 text-sm outline-none resize-none mb-4"
 />

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
 {isSubmitting ?"Closing..." :"End Shift"}
 </button>
 </div>
 </form>
 )}
 </div>
 </div>
 );
}
