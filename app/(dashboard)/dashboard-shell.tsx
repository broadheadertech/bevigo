"use client";
import { ReactNode, useState, useMemo, useCallback } from"react";
import { AuthProvider, useAuth } from"@/lib/auth-context";
import { RoleNavigation } from"@/components/auth/role-navigation";
import { SearchCommand } from"@/components/search/search-command";
import { BrandingProvider, useBranding } from"@/components/providers/branding-provider";
import { ThemeToggle } from"@/components/ui/theme-toggle";

function DashboardNav({ sidebarOpen, onClose }: { sidebarOpen: boolean; onClose: () => void }) {
 const { session, logout } = useAuth();
 const { logoUrl } = useBranding();

 return (
 <>
 {/* Mobile overlay backdrop */}
 {sidebarOpen && (
 <div
 className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
 onClick={onClose}
 />
 )}

 <aside
 className={`
 fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col
 transform transition-transform duration-200 ease-in-out
 md:relative md:translate-x-0
 ${sidebarOpen ?"translate-x-0" :"-translate-x-full"}
 `}
 style={{ backgroundColor: 'var(--card)', borderRight: '1px solid var(--border-color)' }}
 >
 {/* Logo + close button on mobile */}
 <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
 <div className="flex items-center justify-between">
 <div className="flex-1 flex justify-center">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={logoUrl ||"/logo.png"} alt="bevi&go" className="object-contain" style={{ height: '100px' }} />
 </div>
 <button
 onClick={onClose}
 className="md:hidden p-1.5 rounded-2xl transition-colors"
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
 <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-color)' }}>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
 <span className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
 {session.userName?.charAt(0)?.toUpperCase() ??"U"}
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>{session.userName}</p>
 <p className="text-xs capitalize" style={{ color: 'var(--muted-fg)' }}>{session.role}</p>
 </div>
 <ThemeToggle />
 <button
 onClick={logout}
 className="p-1.5 rounded-2xl transition-colors"
 style={{ color: 'var(--muted-fg)' }}
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
 const { logoUrl } = useBranding();
 return (
 <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border-color)' }}>
 <div className="flex items-center gap-2.5">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={logoUrl ||"/logo.png"} alt="bevi&go" className="h-10 object-contain" />
 </div>
 <button
 onClick={onOpen}
 className="p-2 rounded-2xl transition-colors"
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
 if (typeof window ==="undefined") return false;
 return window.innerWidth < 768;
 }, []);

 const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

 const handleOpen = useCallback(() => setSidebarOpen(true), []);
 const handleClose = useCallback(() => setSidebarOpen(false), []);

 return (
 <AuthProvider token={token}>
 <BrandingProvider>
 <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
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
