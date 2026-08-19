import Link from "next/link";
import { GoogleSignInButton } from "@/modules/auth/components/GoogleSignInButton";

import { isInternalRoute } from "@/modules/auth/validations";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const oauthError = params.error === "oauth";
  const nextParam =
    typeof params.next === "string" && isInternalRoute(params.next)
      ? params.next
      : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Bienvenido a Confectu
        </h1>
        <p className="mt-2 text-center text-base text-zinc-600 dark:text-zinc-400">
          Inicia sesión para continuar
        </p>

        {oauthError ? (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400"
          >
            No se pudo iniciar sesión con Google. Intenta de nuevo.
          </div>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton next={nextParam} />
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
