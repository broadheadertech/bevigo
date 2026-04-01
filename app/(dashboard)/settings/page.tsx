"use client";

import { useQuery, useMutation, useAction } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useEffect } from"react";
import { CloneConfigDialog } from"@/components/locations/clone-config-dialog";
import { LocaleSelector } from"@/components/ui/locale-selector";

const TIMEOUT_OPTIONS = [
 { label:"5 minutes", value: 5 * 60 * 1000 },
 { label:"10 minutes", value: 10 * 60 * 1000 },
 { label:"15 minutes", value: 15 * 60 * 1000 },
 { label:"30 minutes", value: 30 * 60 * 1000 },
 { label:"1 hour", value: 60 * 60 * 1000 },
];

export default function SettingsPage() {
 const { session, token } = useAuth();

 const settings = useQuery(
 api.settings.queries.getSettings,
 token ? { token } :"skip"
 );
 const updateTimeout = useMutation(api.settings.mutations.updateIdleLockTimeout);
 const resetPinAction = useAction(api.staff.mutations.resetPin);

 const [selectedTimeout, setSelectedTimeout] = useState<number>(5 * 60 * 1000);
 const [isSaving, setIsSaving] = useState(false);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [showCloneDialog, setShowCloneDialog] = useState(false);
 const [myPin, setMyPin] = useState("");
 const [pinSaving, setPinSaving] = useState(false);
 const [pinMessage, setPinMessage] = useState<string | null>(null);

 // Sync from server settings when loaded
 useEffect(() => {
 if (settings?.idleLockTimeoutMs) {
 setSelectedTimeout(settings.idleLockTimeoutMs);
 }
 }, [settings?.idleLockTimeoutMs]);

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 if (session.role !=="owner") {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Only owners can access settings.</p>
 </div>
 );
 }

 const handleSave = async () => {
 setIsSaving(true);
 setError(null);
 setSuccessMessage(null);

 try {
 await updateTimeout({
 token,
 idleLockTimeoutMs: selectedTimeout,
 });
 setSuccessMessage("Settings saved successfully.");
 } catch (err) {
 setError(err instanceof Error ? err.message :"Failed to save settings");
 } finally {
 setIsSaving(false);
 }
 };

 const hasChanges = settings && selectedTimeout !== settings.idleLockTimeoutMs;

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Settings</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>Configure your POS system preferences</p>
 </div>

 <div className="space-y-6 max-w-lg">
 {/* Session Settings Section */}
 <div className="rounded-2xl border shadow-lg p-6">
 <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--fg)' }}>Session Settings</h2>
 <p className="text-sm mb-6">
 Configure auto-lock timeout for register sessions. After this period
 of inactivity, the register will lock and require PIN entry.
 </p>

 <div className="mb-6">
 <label
 htmlFor="idle-timeout"
 className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-fg)' }}
 >
 Auto-lock idle timeout
 </label>
 <select
 id="idle-timeout"
 value={selectedTimeout}
 onChange={(e) => {
 setSelectedTimeout(Number(e.target.value));
 setSuccessMessage(null);
 setError(null);
 }}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 {TIMEOUT_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 <p className="mt-1.5 text-xs">
 Minimum: 5 minutes. Applies to all register sessions across all locations.
 </p>
 </div>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 {successMessage && (
 <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
 {successMessage}
 </div>
 )}

 <button
 onClick={handleSave}
 disabled={isSaving || !hasChanges}
 className="px-4 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {isSaving ?"Saving..." :"Save"}
 </button>
 </div>

 {/* My Quick-PIN Section */}
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--fg)' }}>My Quick-PIN</h2>
 <p className="text-sm mb-6" style={{ color: 'var(--muted-fg)' }}>
  Set your 4-6 digit PIN for register access and quick switching. This PIN is used to unlock the register after idle lock.
 </p>

 <div className="mb-4">
  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
   New PIN
  </label>
  <input
   type="text"
   inputMode="numeric"
   pattern="\d{4,6}"
   maxLength={6}
   value={myPin}
   onChange={(e) => { setMyPin(e.target.value.replace(/\D/g, "")); setPinMessage(null); }}
   className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
   style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
   placeholder="Enter 4-6 digit PIN"
  />
 </div>

 {pinMessage && (
  <div className={`mb-4 p-3 rounded-xl text-sm ${pinMessage.includes("success") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
   {pinMessage}
  </div>
 )}

 <button
  onClick={async () => {
   if (!token || !session) return;
   if (myPin.length < 4) { setPinMessage("PIN must be 4-6 digits"); return; }
   setPinSaving(true);
   setPinMessage(null);
   try {
    await resetPinAction({ token, userId: session.userId, newPin: myPin });
    setPinMessage("PIN set successfully!");
    setMyPin("");
   } catch (err) {
    setPinMessage(err instanceof Error ? err.message : "Failed to set PIN");
   } finally {
    setPinSaving(false);
   }
  }}
  disabled={pinSaving || myPin.length < 4}
  className="px-4 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  style={{ backgroundColor: 'var(--accent-color)' }}
 >
  {pinSaving ? "Saving..." : "Set PIN"}
 </button>
 </div>

 {/* Language Section */}
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--fg)' }}>Language</h2>
 <p className="text-sm mb-6">
 Choose the display language for the POS interface.
 </p>
 <LocaleSelector />
 </div>

 {/* Location Management Section */}
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--fg)' }}>Location Management</h2>
 <p className="text-sm mb-6">
 Clone configuration between locations, including menu pricing, tax
 settings, operating hours, and currency.
 </p>
 <button
 onClick={() => setShowCloneDialog(true)}
 className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
 >
 Clone Configuration
 </button>
 </div>
 </div>

 {showCloneDialog && (
 <CloneConfigDialog onClose={() => setShowCloneDialog(false)} />
 )}
 </div>
 );
}
