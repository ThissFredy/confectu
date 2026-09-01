"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface MenuItem {
  label: string;
  href: string;
  comingSoon?: boolean;
}

const menuItems: MenuItem[] = [
  { label: "Inicio", href: "/admin" },
  { label: "Tipos de documento", href: "/admin/document-types" },
  { label: "Talleres", href: "/admin/workshops" },
  { label: "Configuración", href: "/admin/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="shrink-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center justify-between px-4 md:h-auto md:justify-end">
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 md:hidden">
          Menú
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="admin-sidebar-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-lg text-zinc-900 transition-colors hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-800 md:hidden"
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
            {open ? (
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

      <nav
        id="admin-sidebar-nav"
        aria-label="Administración"
        className={`${open ? "block" : "hidden"} border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 md:block md:border-t-0`}
      >
        <ul className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            const content = (
              <span className="flex h-12 min-h-[44px] items-center rounded-lg px-3 text-base font-medium">
                {item.label}
                {item.comingSoon ? (
                  <span className="ml-auto text-xs text-zinc-400">
                    Próximamente
                  </span>
                ) : null}
              </span>
            );

            return (
              <li key={item.href}>
                {item.comingSoon ? (
                  <div
                    className="cursor-not-allowed opacity-60"
                    aria-disabled="true"
                  >
                    {content}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block transition-colors ${
                      active
                        ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
