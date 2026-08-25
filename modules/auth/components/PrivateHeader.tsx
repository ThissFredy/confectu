"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getWorkshopSettings } from "../queries";
import { LogoutButton } from "./LogoutButton";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clientes", href: "/customers" },
  { label: "Servicios", href: "/services" },
  { label: "Facturas", href: "/invoices" },
  { label: "Configuración", href: "/settings" },
];

export function PrivateHeader() {
  const pathname = usePathname();
  const [businessName, setBusinessName] = useState<string>("Taller");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const supabase = createClient();
      const settings = await getWorkshopSettings(supabase);
      if (!cancelled && settings?.businessName) {
        setBusinessName(settings.businessName);
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="flex min-h-[44px] items-center text-lg font-bold text-zinc-900 dark:text-zinc-100"
        >
          {businessName}
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Navegación principal"
        >
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 min-h-[44px] min-w-[44px] items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <LogoutButton />
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-lg text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800 md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </>
            ) : (
              <>
                <path d="M4 12h16" />
                <path d="M4 18h16" />
                <path d="M4 6h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-menu"
          aria-label="Navegación móvil"
          className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-12 min-h-[44px] items-center rounded-lg px-3 text-base font-medium transition-colors ${
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2">
              <LogoutButton />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
