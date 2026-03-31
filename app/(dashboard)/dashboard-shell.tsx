"use client";
import { ReactNode, useState, useMemo, useCallback } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { RoleNavigation } from "@/components/auth/role-navigation";
import { SearchCommand } from "@/components/search/search-command";
import { BrandingProvider, useBranding } from "@/components/providers/branding-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function DashboardNav({ sidebarOpen, onClose }: { sidebarOpen: boolean; onClose: () => void }) {
  const { session, logout } = useAuth();
  const { brandName, logoUrl } = useBranding();

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + close button on mobile */}
        <div className="px-5 py-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none">
                    <ellipse cx="50" cy="50" rx="38" ry="30" fill="#7C3A12" transform="rotate(-30 50 50)" />
                    <path d="M30 45 Q50 35 70 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100 tracking-tight" style={{ fontStyle: brandName ? "normal" : "italic" }}>
                  {brandName || "bevi&go"}
                </h1>
                <p className="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest">POS</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:text-stone-500 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              title="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="pt-3">
          <SearchCommand />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <RoleNavigation />
        </div>

        {/* User */}
        {session && (
          <div className="px-4 py-4 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {session.userName?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{session.userName}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 capitalize">{session.role}</p>
              </div>
              <ThemeToggle />
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:text-stone-500 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  const { brandName, logoUrl } = useBranding();
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 flex items-center justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-6 h-6 rounded-lg object-cover" />
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
              <ellipse cx="50" cy="50" rx="38" ry="30" fill="#7C3A12" transform="rotate(-30 50 50)" />
              <path d="M30 45 Q50 35 70 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <h1 className="text-sm font-semibold text-stone-900 dark:text-stone-100 tracking-tight" style={{ fontStyle: brandName ? "normal" : "italic" }}>
          {brandName || "bevi&go"}
        </h1>
      </div>
      <button
        onClick={onOpen}
        className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
        title="Open menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}

export function DashboardShell({
  children,
  token,
}: {
  children: ReactNode;
  token: string | null;
}) {
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const handleOpen = useCallback(() => setSidebarOpen(true), []);
  const handleClose = useCallback(() => setSidebarOpen(false), []);

  return (
    <AuthProvider token={token}>
      <BrandingProvider>
        <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-900">
          <MobileTopBar onOpen={handleOpen} />
          <div className="flex flex-1">
            <DashboardNav sidebarOpen={sidebarOpen} onClose={handleClose} />
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-4 md:px-8 md:py-6">{children}</div>
            </main>
          </div>
        </div>
      </BrandingProvider>
    </AuthProvider>
  );
}
