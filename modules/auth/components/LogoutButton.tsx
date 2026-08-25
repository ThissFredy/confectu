"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Cerrar sesión"
      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={signOut}>
      <SubmitButton />
    </form>
  );
}
