"use client";

import { useQuery } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { use } from"react";

type MenuItem = {
 name: string;
 description?: string;
 effectivePrice: number;
 isFeatured: boolean;
};

type MenuCategory = {
 name: string;
 items: MenuItem[];
};

function formatPrice(cents: number): string {
 return"P" + (cents / 100).toFixed(2);
}

export default function PublicMenuPage({
 params,
}: {
 params: Promise<{ locationSlug: string }>;
}) {
 const { locationSlug } = use(params);
 const menu = useQuery(api.menu.publicQueries.getPublicMenu, { locationSlug });

 // Loading state
 if (menu === undefined) {
 return (
 <div className="mx-auto max-w-md min-h-screen px-4 py-8">
 <div className="animate-pulse space-y-6">
 <div className="h-8 w-48 rounded bg-stone-200" />
 <div className="space-y-4">
 <div className="h-5 w-32 rounded bg-stone-200" />
 <div className="h-16 w-full rounded" />
 <div className="h-16 w-full rounded" />
 </div>
 <div className="space-y-4">
 <div className="h-5 w-32 rounded bg-stone-200" />
 <div className="h-16 w-full rounded" />
 </div>
 </div>
 </div>
 );
 }

 // Location not found
 if (menu === null) {
 return (
 <div className="mx-auto max-w-md min-h-screen px-4 py-12 text-center">
 <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Menu Not Found</h1>
 <p className="mt-3">
 This menu is not available. Please check the URL or scan the QR code
 again.
 </p>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-md min-h-screen">
 {/* Header */}
 <header className="sticky top-0 z-10/95 px-4 py-4 backdrop-blur-sm">
 <div className="flex items-center gap-2.5">
 {menu.brandLogoUrl && (
 <img src={menu.brandLogoUrl} alt="Logo" className="w-8 h-8 rounded-2xl object-cover" />
 )}
 <div>
 <h1 className="text-xl font-bold" style={{ color: menu.primaryColor ||"#1c1917" }}>
 {menu.brandName || menu.locationName}
 </h1>
 {menu.brandName && (
 <p className="text-sm">{menu.locationName}</p>
 )}
 <p className="text-sm">Menu</p>
 </div>
 </div>
 </header>

 {/* Menu Content */}
 <main className="px-4 pb-20 pt-4">
 {menu.categories.map((category: MenuCategory) => (
 <section key={category.name} className="mb-8">
 {/* Category Header */}
 <div className="mb-3 pb-2">
 <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
 {category.name}
 </h2>
 </div>

 {/* Items */}
 <div className="space-y-3">
 {category.items.map((item: MenuItem) => (
 <div
 key={item.name}
 className={`flex items-start justify-between gap-3 rounded-2xl p-3 ${
 item.isFeatured
 ?"border border-amber-500/20 bg-amber-500/10"
 :"border"
 }`}
 >
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5">
 <span className="font-medium">
 {item.name}
 </span>
 {item.isFeatured && (
 <span
 className="text-amber-500"
 title="Featured"
 aria-label="Featured item"
 >
 &#9733;
 </span>
 )}
 </div>
 {item.description && (
 <p className="mt-0.5 text-sm leading-snug">
 {item.description}
 </p>
 )}
 </div>
 <span className="shrink-0 font-semibold">
 {formatPrice(item.effectivePrice)}
 </span>
 </div>
 ))}
 </div>
 </section>
 ))}

 {menu.categories.length === 0 && (
 <p className="py-8 text-center">
 No menu items available at this time.
 </p>
 )}
 </main>

 {/* Footer */}
 <footer className="fixed bottom-0 left-0 right-0 border-t/95 py-3 text-center backdrop-blur-sm">
 <p className="text-xs">Powered by {menu.brandName ||"bevi&go"}</p>
 </footer>
 </div>
 );
}
