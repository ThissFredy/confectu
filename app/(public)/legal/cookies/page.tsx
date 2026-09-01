import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies | Confectu",
  description:
    "Política de cookies de Confectu: cookies técnicas de sesión y cómo gestionarlas.",
};

export default function CookiesPolicyPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Política de cookies
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: 27 de agosto de 2026
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          1. Qué son las cookies
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Las cookies son pequeños archivos de texto que se almacenan en tu
          dispositivo al visitar un sitio web. Se utilizan para recordar
          información y mantener el funcionamiento de la sesión.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2. Cookies que utilizamos
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu utiliza únicamente cookies técnicas de sesión, estrictamente
          necesarias para el funcionamiento de la plataforma y la
          autenticación. No utilizamos cookies de publicidad ni de análisis.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          3. Cookies de terceros
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Al iniciar sesión con Google, este servicio puede establecer cookies
          propias necesarias para la autenticación. Asimismo, Supabase puede
          emplear cookies o almacenamiento local para mantener tu sesión activa.
          Consulta sus respectivas políticas para más información.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          4. Cómo gestionar o desactivar las cookies
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Puedes configurar tu navegador para bloquear o eliminar cookies. Ten
          en cuenta que desactivar las cookies técnicas puede impedir el acceso
          o el correcto funcionamiento de la plataforma.
        </p>
      </section>
    </article>
  );
}
