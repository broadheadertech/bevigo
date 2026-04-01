"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Role = "owner" | "manager" | "barista";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
  children?: NavItem[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    roles: ["owner", "manager"],
  },
  {
    label: "Register",
    href: "/order",
    icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    roles: ["barista", "manager", "owner"],
  },
  {
    label: "Orders",
    href: "/orders",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    roles: ["manager", "owner"],
  },
  {
    label: "Staff",
    href: "/staff",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    roles: ["manager", "owner"],
    children: [
      {
        label: "Assignments",
        href: "/staff/assignments",
        icon: "",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Menu",
    href: "/menu",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    roles: ["manager", "owner"],
    children: [
      {
        label: "Modifiers",
        href: "/menu/modifiers",
        icon: "",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    roles: ["owner", "manager"],
  },
  {
    label: "Shifts",
    href: "/shifts",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    roles: ["barista", "manager", "owner"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    roles: ["owner", "manager"],
    children: [
      {
        label: "Purchase Orders",
        href: "/inventory/purchase-orders",
        icon: "",
        roles: ["manager", "owner"],
      },
      {
        label: "Adjustments",
        href: "/inventory/adjustments",
        icon: "",
        roles: ["manager", "owner"],
      },
      {
        label: "Recipes",
        href: "/inventory/recipes",
        icon: "",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    roles: ["manager", "owner"],
    children: [
      {
        label: "COGS",
        href: "/reports/cogs",
        icon: "",
        roles: ["owner"],
      },
      {
        label: "Staff Performance",
        href: "/reports/staff",
        icon: "",
        roles: ["manager", "owner"],
      },
      {
        label: "Valuation",
        href: "/reports/valuation",
        icon: "",
        roles: ["owner"],
      },
      {
        label: "Analytics",
        href: "/reports/analytics",
        icon: "",
        roles: ["manager", "owner"],
      },
    ],
  },
  {
    label: "Tables",
    href: "/tables",
    icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
    roles: ["owner"],
  },
  {
    label: "Locations",
    href: "/locations",
    icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    roles: ["owner"],
  },
  {
    label: "Audit Log",
    href: "/audit",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    roles: ["owner"],
  },
  // Billing hidden for now
  // {
  //   label: "Billing",
  //   href: "/billing",
  //   icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  //   roles: ["owner"],
  //   children: [
  //     {
  //       label: "Upgrade",
  //       href: "/billing/upgrade",
  //       icon: "",
  //       roles: ["owner"],
  //     },
  //   ],
  // },
  {
    label: "Help",
    href: "/help",
    icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    roles: ["owner", "manager", "barista"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    roles: ["owner"],
    children: [
      {
        label: "Branding",
        href: "/settings/branding",
        icon: "",
        roles: ["owner"],
      },
      {
        label: "Custom Domain",
        href: "/settings/domain",
        icon: "",
        roles: ["owner"],
      },
      {
        label: "White-Label",
        href: "/settings/white-label",
        icon: "",
        roles: ["owner"],
      },
    ],
  },
];

export function RoleNavigation() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading || !session) return null;

  const userRole = session.role as Role;
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {visibleItems.map((item) => {
        const active = isActive(item.href);
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-amber-50 text-amber-900 shadow-sm"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <svg
                className={`w-5 h-5 shrink-0 ${active ? "text-amber-600" : "text-stone-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={item.icon}
                />
              </svg>
              {item.label}
            </Link>
            {item.children &&
              item.children
                .filter((child) => child.roles.includes(userRole))
                .map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-3 pl-11 pr-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                      isActive(child.href)
                        ? "text-amber-700 font-medium"
                        : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                    }`}
                  >
                    {child.label}
                  </Link>
                ))}
          </div>
        );
      })}
    </nav>
  );
}
