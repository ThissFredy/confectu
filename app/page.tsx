import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-center text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Confectu
        </h1>
        <p className="mt-3 text-center text-base text-zinc-600 dark:text-zinc-400">
          Gestiona tu taller de confección: clientes, servicios y facturas.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Iniciar sesión
          </Link>
        </div>
        <nav
          aria-label="Legal"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400"
        >
          <Link
            href="/legal/aviso-legal"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Aviso legal
          </Link>
          <Link
            href="/legal/privacidad"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Privacidad
          </Link>
          <Link
            href="/legal/terminos"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Términos
          </Link>
          <Link
            href="/legal/cookies"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cookies
          </Link>
        </nav>
      </main>
    </div>
  );
}
