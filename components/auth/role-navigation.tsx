"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

type Role = "owner" | "manager" | "barista";

type NavItem = {
  label: string;
  href: string;
  roles: Role[];
  children?: NavItem[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    roles: ["owner", "manager"],
  },
  {
    label: "Register",
    href: "/order",
    roles: ["barista", "manager", "owner"],
  },
  {
    label: "Staff",
    href: "/staff",
    roles: ["manager", "owner"],
    children: [
      {
        label: "Assignments",
        href: "/staff/assignments",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Menu Management",
    href: "/menu",
    roles: ["manager", "owner"],
  },
  {
    label: "Reporting",
    href: "/dashboard/reports",
    roles: ["manager", "owner"],
  },
  {
    label: "Locations",
    href: "/dashboard/locations",
    roles: ["owner"],
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    roles: ["owner"],
  },
];

/**
 * Role-based navigation component for the dashboard sidebar.
 * Renders navigation links filtered by the current user's role.
 * This is cosmetic only — server-side guards remain the source of truth (NFR11).
 */
export function RoleNavigation() {
  const { session, isLoading } = useAuth();

  if (isLoading || !session) return null;

  const userRole = session.role as Role;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => (
        <div key={item.href}>
          <Link
            href={item.href}
            className="px-3 py-2 rounded hover:bg-gray-800 transition-colors block"
          >
            {item.label}
          </Link>
          {item.children &&
            item.children
              .filter((child) => child.roles.includes(userRole))
              .map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className="px-3 py-2 rounded hover:bg-gray-800 transition-colors pl-6 text-sm text-gray-300 block"
                >
                  {child.label}
                </Link>
              ))}
        </div>
      ))}
    </nav>
  );
}
