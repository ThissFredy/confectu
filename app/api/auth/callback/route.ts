import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { isInternalRoute } from "@/modules/auth/validations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const authState = await resolveAuthState(supabase);

  if (authState.status === "inactive") {
    return NextResponse.redirect(new URL("/account-disabled", request.url));
  }

  if (authState.status === "needs_onboarding") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (authState.status === "active" && authState.profile) {
    const target =
      typeof next === "string" && isInternalRoute(next) ? next : null;

    if (authState.profile.role === "ADMIN") {
      return NextResponse.redirect(
        new URL(target ?? "/admin", request.url),
      );
    }

    return NextResponse.redirect(
      new URL(target ?? "/dashboard", request.url),
    );
  }

  return NextResponse.redirect(new URL("/login?error=oauth", request.url));
}
