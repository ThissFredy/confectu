import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { isInternalRoute } from "@/modules/auth/validations";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/api/auth/callback",
  "/account-disabled",
  "/legal/aviso-legal",
  "/legal/cookies",
  "/legal/privacidad",
  "/legal/terminos",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

function isPrivateRoute(pathname: string): boolean {
  return (
    pathname === "/onboarding" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/settings")
  );
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated") {
    if (isPublicRoute(pathname)) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    if (isInternalRoute(pathname)) {
      loginUrl.searchParams.set("next", pathname);
    }
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (authState.status === "inactive") {
    if (pathname === "/account-disabled") {
      return response;
    }
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/account-disabled", request.url)),
    );
  }

  if (authState.status === "needs_onboarding") {
    if (pathname === "/onboarding") {
      return response;
    }
    if (pathname === "/login") {
      return copyCookies(
        response,
        NextResponse.redirect(new URL("/onboarding", request.url)),
      );
    }
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/onboarding", request.url)),
    );
  }

  // status === "active"
  const role = authState.profile?.role;

  if (role === "ADMIN") {
    if (isAdminRoute(pathname) || pathname === "/account-disabled") {
      return response;
    }
    if (pathname === "/login") {
      return copyCookies(
        response,
        NextResponse.redirect(new URL("/admin", request.url)),
      );
    }
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/admin", request.url)),
    );
  }

  // role === "CLIENT"
  if (pathname === "/onboarding") {
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  if (pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const target =
      typeof next === "string" && isInternalRoute(next) ? next : "/dashboard";
    return copyCookies(
      response,
      NextResponse.redirect(new URL(target, request.url)),
    );
  }

  if (isAdminRoute(pathname)) {
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  if (isPrivateRoute(pathname) || isPublicRoute(pathname)) {
    return response;
  }

  return copyCookies(
    response,
    NextResponse.redirect(new URL("/dashboard", request.url)),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
