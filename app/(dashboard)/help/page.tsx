"use client";

import { useState } from"react";

type FAQItem = {
 question: string;
 answer: string;
};

type FAQSection = {
 title: string;
 items: FAQItem[];
};

const FAQ_DATA: FAQSection[] = [
 {
 title:"Getting Started",
 items: [
 {
 question:"How do I log in?",
 answer:
"Use your email and password on the login page. For the demo account, use: owner@democoffee.ph / brewcast123.",
 },
 {
 question:"How do I create a new account?",
 answer:
 'Click"Sign Up" on the login page. Enter your name, shop name, email, and password. A default location (Main Branch) is created automatically.',
 },
 {
 question:"What are the user roles?",
 answer:
"There are three roles: Owner (full access to all features), Manager (location-scoped access to operations), and Barista (register and shift access only).",
 },
 ],
 },
 {
 title:"Register / Cashiering",
 items: [
 {
 question:"How do I take an order?",
 answer:
 'Go to Register (/order). Start a shift first (enter opening cash). Tap menu items to add to the order. Select modifiers if prompted. Tap"Complete Order" and choose a payment type.',
 },
 {
 question:"How do I start a shift?",
 answer:
 'On the register page, tap"Start" in the shift bar at the top. Enter your opening cash amount.',
 },
 {
 question:"How do I end a shift?",
 answer:
 'Go to the Shifts page, find your active shift, and click"End Shift". Enter your closing cash — the system shows expected vs actual variance.',
 },
 {
 question:"How do I assign an order to a table?",
 answer:
 'In the register, use the Table dropdown above the order panel. Select a table (green = available, amber = occupied). Choose"No Table / Takeout" for counter orders.',
 },
 {
 question:"How do I void an order?",
 answer:
 'On a completed order, tap"Void". Enter a manager/owner PIN for authorization and provide a reason.',
 },
 {
 question:"How do I link a customer to an order?",
 answer:
 'Tap"Customer" in the order panel. Search by phone number or create a new customer. Stamps are added automatically on order completion.',
 },
 {
 question:"What are the keyboard shortcuts?",
 answer:
 'F2 = Complete Order, F8 = Void, Escape = Cancel, 1-9 = Select category, +/- = Quantity. Click the"?" button on the register for the full list.',
 },
 ],
 },
 {
 title:"Menu Management",
 items: [
 {
 question:"How do I add menu items?",
 answer:
 'Go to Menu (/menu). Click"+ Add Item". Enter the name, description, price (in pesos), select a category, and optionally mark the item as featured.',
 },
 {
 question:"How do I create categories?",
 answer:
 'On the Menu page, click"+ Add Category". Enter a name and sort order.',
 },
 {
 question:"How do I set up modifiers?",
 answer:
"Go to Menu then Modifiers (/menu/modifiers). Create modifier groups (e.g., Size, Milk, Extras) with options and price adjustments. Then assign groups to menu items.",
 },
 {
 question:"How do I set different prices per location?",
 answer:
"Edit a menu item and use the Price Override panel. Set location-specific prices that override the base price.",
 },
 {
 question:"How do I clone a menu to a new location?",
 answer:
 'Go to Settings then Clone Configuration. Select source and target locations. Check"Menu Pricing" to copy all price overrides.',
 },
 ],
 },
 {
 title:"Inventory",
 items: [
 {
 question:"How do I add ingredients?",
 answer:
 'Go to Inventory (/inventory). Click"Add Ingredient". Enter the name, unit (g, ml, pcs), category, and reorder threshold.',
 },
 {
 question:"How do I set stock levels?",
 answer:
"On the Inventory page, click the stock number for any ingredient to edit it. Enter the current quantity.",
 },
 {
 question:"How do I link recipes to menu items?",
 answer:
"Go to Inventory then Recipes (/inventory/recipes). Select a menu item, then add ingredients with the quantity used per serving. Example: Americano uses 18g espresso beans + 1 cup.",
 },
 {
 question:"How does auto-deduction work?",
 answer:
"When an order is completed, the system automatically deducts ingredient quantities based on recipes. If an Americano uses 18g beans and you sell 10, it deducts 180g.",
 },
 {
 question:"How do I restock ingredients?",
 answer:
"Create a Purchase Order at Inventory then Purchase Orders (/inventory/purchase-orders). Add items, mark as ordered, then receive when delivered — stock updates automatically.",
 },
 {
 question:"What are stock adjustments?",
 answer:
"Go to Inventory then Adjustments (/inventory/adjustments). Log wastage (spoiled milk), corrections (miscounted stock), or stock takes (physical count reconciliation).",
 },
 {
 question:"What does the low stock alert mean?",
 answer:
"When an ingredient falls below its reorder threshold, an amber/red banner appears on the dashboard. Go to Inventory to reorder.",
 },
 ],
 },
 {
 title:"Staff Management",
 items: [
 {
 question:"How do I add staff?",
 answer:
 'Go to Staff (/staff). Click"+ Add Staff". Set the name, email, role, and Quick-PIN.',
 },
 {
 question:"How do I assign staff to locations?",
 answer:
"Go to Staff then Assignments (/staff/assignments). Toggle checkboxes in the assignment matrix.",
 },
 {
 question:"What is a Quick-PIN?",
 answer:
"A 4-6 digit PIN for fast register switching. Baristas use it to clock in on shared tablets.",
 },
 ],
 },
 {
 title:"Locations",
 items: [
 {
 question:"How do I add a new location?",
 answer:
 'Go to Locations (/locations). Click"Add Location". Enter the name, address, timezone, currency, tax rate (e.g., 12% = 1200 basis points), and operating hours.',
 },
 {
 question:"How do I configure tax?",
 answer:
 'In the location form, set Tax Rate (in basis points: 1200 = 12%) and Tax Label (e.g.,"VAT"). Tax is automatically calculated on every order.',
 },
 {
 question:"How do I clone settings between locations?",
 answer:
"Go to Settings then Clone Configuration. Select source/target and choose what to copy (pricing, tax, hours, currency).",
 },
 ],
 },
 {
 title:"Reports",
 items: [
 {
 question:"How do I view sales reports?",
 answer:
"Go to Reports (/reports). See daily summary, product mix, and hourly volume. Filter by date range and location.",
 },
 {
 question:"What is the COGS report?",
 answer:
"Reports then COGS (/reports/cogs) shows Cost of Goods Sold per item based on ingredient costs from purchase orders. Green margins = healthy, red = review pricing.",
 },
 {
 question:"How do I export data?",
 answer:
 'Click"Export CSV" or"Export PDF" on any report page. CSV downloads immediately. PDF opens a print-ready page.',
 },
 {
 question:"What is Order Analytics?",
 answer:
"Order Analytics (/reports/analytics) provides detailed breakdowns of your orders by payment type, time of day, staff performance, table usage, peak days, void tracking, and customer repeat rates. Use date range and location filters to analyze specific periods.",
 },
 ],
 },
 {
 title:"Customers & Loyalty",
 items: [
 {
 question:"How does the loyalty program work?",
 answer:
"Customers earn 1 stamp per order. After 10 stamps, they get a free reward. Cards auto-reset after redemption.",
 },
 {
 question:"How do I add a customer?",
 answer:
 'Go to Customers (/customers) or use the"Customer" button in the register. Enter name and phone number.',
 },
 ],
 },
 {
 title:"Tables",
 items: [
 {
 question:"How do I set up tables?",
 answer:
 'Go to Tables (/tables). Add tables with name, zone (Indoor/Outdoor/Bar), and capacity. Or use"Seed Sample Tables" for a quick start.',
 },
 {
 question:"How do tables work in the register?",
 answer:
"Use the Table dropdown in the register. Available tables are green, occupied are amber. Selecting an occupied table switches to its order.",
 },
 ],
 },
 {
 title:"Settings",
 items: [
 {
 question:"How do I change the auto-lock timeout?",
 answer:
"Go to Settings (/settings). Adjust the idle timeout (5 min to 1 hour). The register locks after this period of inactivity.",
 },
 {
 question:"How do I customize branding?",
 answer:
"Go to Settings then Branding (/settings/branding). Set your brand name, logo URL, and brand colors.",
 },
 {
 question:"How do I change the language?",
 answer:
"Go to Settings. Choose between English, Filipino, or Bahasa Indonesia.",
 },
 {
 question:"How do I switch between dark and light mode?",
 answer:
"Click the theme toggle button (sun/moon icon) in the sidebar.",
 },
 ],
 },
 {
 title:"Audit Log",
 items: [
 {
 question:"What is the audit log?",
 answer:
"Every change in the system (menu edits, price changes, staff updates, order voids) is logged with who did it, when, and what changed. Go to Audit Log (/audit) to view.",
 },
 ],
 },
 {
 title:"Printing",
 items: [
 {
 question:"How do I connect a receipt printer?",
 answer:
 'In the register, click the printer icon in the top bar. Click"Connect" to pair a USB thermal printer via Web Serial. Use"Test Print" to verify.',
 },
 {
 question:"How do I enable auto-print?",
 answer:
 'In printer settings, toggle"Auto-print" on. Receipts will print automatically after each completed order.',
 },
 ],
 },
];

function AccordionItem({ item }: { item: FAQItem }) {
 const [open, setOpen] = useState(false);

 return (
 <div
 style={{
 borderColor:"var(--border-color)",
 }}
 className="border-b last:border-b-0"
 >
 <button
 onClick={() => setOpen(!open)}
 className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium transition-colors"
 style={{ color:"var(--card-fg)" }}
 >
 <span>{item.question}</span>
 <svg
 className="h-4 w-4 shrink-0 transition-transform duration-200"
 style={{
 transform: open ?"rotate(180deg)" :"rotate(0deg)",
 color:"var(--muted-fg)",
 }}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M19 9l-7 7-7-7"
 />
 </svg>
 </button>
 <div
 className="overflow-hidden transition-all duration-200"
 style={{
 maxHeight: open ?"500px" :"0px",
 opacity: open ? 1 : 0,
 }}
 >
 <p
 className="px-4 pb-4 text-sm leading-relaxed"
 style={{ color:"var(--muted-fg)" }}
 >
 {item.answer}
 </p>
 </div>
 </div>
 );
}

export default function HelpPage() {
 const [search, setSearch] = useState("");

 const filteredSections = FAQ_DATA.map((section) => ({
 ...section,
 items: section.items.filter(
 (item) =>
 item.question.toLowerCase().includes(search.toLowerCase()) ||
 item.answer.toLowerCase().includes(search.toLowerCase())
 ),
 })).filter((section) => section.items.length > 0);

 return (
 <div className="mx-auto max-w-3xl px-4 py-8">
 <div className="mb-8">
 <h1
 className="text-2xl font-bold tracking-tight"
 style={{ color:"var(--fg)" }}
 >
 Help Center
 </h1>
 <p className="mt-1 text-sm" style={{ color:"var(--muted-fg)" }}>
 Learn how to use bevi&amp;go POS
 </p>
 </div>

 <div className="relative mb-8">
 <svg
 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
 style={{ color:"var(--muted-fg)" }}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
 />
 </svg>
 <input
 type="text"
 placeholder="Search help topics..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:ring-2 focus:ring-amber-500/30"
 style={{
 backgroundColor:"var(--card)",
 color:"var(--card-fg)",
 borderColor:"var(--border-color)",
 }}
 />
 </div>

 {filteredSections.length === 0 && (
 <p
 className="py-12 text-center text-sm"
 style={{ color:"var(--muted-fg)" }}
 >
 No results found for &ldquo;{search}&rdquo;. Try a different search
 term.
 </p>
 )}

 <div className="flex flex-col gap-6">
 {filteredSections.map((section) => (
 <div key={section.title}>
 <h2
 className="mb-2 text-xs font-semibold uppercase tracking-wider"
 style={{ color:"var(--muted-fg)" }}
 >
 {section.title}
 </h2>
 <div
 className="overflow-hidden rounded-xl border"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 {section.items.map((item) => (
 <AccordionItem key={item.question} item={item} />
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}
