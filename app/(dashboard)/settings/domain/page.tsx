"use client";

import { useQuery, useMutation } from"convex/react";
import { api } from"../../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useEffect } from"react";

export default function DomainSettingsPage() {
 const { session, token } = useAuth();

 const branding = useQuery(
 api.settings.queries.getBranding,
 token ? { token } :"skip"
 );
 const updateDomain = useMutation(api.settings.mutations.updateCustomDomain);

 const [customDomain, setCustomDomain] = useState("");
 const [isSaving, setIsSaving] = useState(false);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 if (branding?.customDomain) {
 setCustomDomain(branding.customDomain);
 }
 }, [branding?.customDomain]);

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
 <p style={{ color: 'var(--muted-fg)' }}>Only owners can access domain settings.</p>
 </div>
 );
 }

 const handleSave = async () => {
 setIsSaving(true);
 setError(null);
 setSuccessMessage(null);

 try {
 await updateDomain({ token, customDomain });
 setSuccessMessage("Custom domain saved. Verification is not yet active.");
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message :"Failed to save domain");
 } finally {
 setIsSaving(false);
 }
 };

 const tenantSlug = session.tenantId.split("|").pop() ??"your-shop";

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Custom Domain</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 Configure a custom domain for your public menu and storefront
 </p>
 </div>

 <div className="space-y-6 max-w-lg">
 {/* Current domain */}
 <div className="rounded-2xl border shadow-lg p-6">
 <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--fg)' }}>Current Domain</h2>
 <p className="text-sm mb-4">
 Your public menu is accessible at:
 </p>
 <div className="px-3 py-2.5 rounded-xl text-sm font-mono">
 {tenantSlug}.bevigo.app
 </div>
 </div>

 {/* Custom domain */}
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <div className="flex items-center gap-2 mb-4">
 <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Custom Domain</h2>
 <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full">
 Coming Soon
 </span>
 </div>

 <p className="text-sm mb-4">
 Use your own domain for the public menu. Follow these steps:
 </p>

 <ol className="text-sm space-y-3 mb-6 list-decimal list-inside">
 <li>
 Add a <span className="font-mono text-xs px-1.5 py-0.5 rounded">CNAME</span> record
 pointing to <span className="font-mono text-xs px-1.5 py-0.5 rounded">bevigo.app</span>
 </li>
 <li>Enter your domain below</li>
 <li>We&apos;ll verify and activate it</li>
 </ol>

 <div className="mb-4">
 <label htmlFor="custom-domain" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Your Domain
 </label>
 <input
 id="custom-domain"
 type="text"
 value={customDomain}
 onChange={(e) => { setCustomDomain(e.target.value); setSuccessMessage(null); }}
 placeholder="menu.yourcoffeeshop.com"
 className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 {successMessage && (
 <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-sm">
 {successMessage}
 </div>
 )}

 <button
 onClick={handleSave}
 disabled={isSaving || !customDomain}
 className="px-4 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {isSaving ?"Saving..." :"Save Domain"}
 </button>
 </div>
 </div>
 </div>
 );
}
