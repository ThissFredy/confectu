import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="/admin"
          className="flex min-h-[44px] items-center text-lg font-bold text-zinc-900 dark:text-zinc-100"
        >
          Confectu Admin
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
