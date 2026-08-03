import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 5_000;

type AuthResult = Awaited<
  ReturnType<ReturnType<typeof createServerClient>["auth"]["getUser"]>
>;

async function getUserWithTimeout(
  getUser: () => Promise<AuthResult>
): Promise<{ user: AuthResult["data"]["user"]; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      getUser().then((r) => ({ kind: "ok" as const, r })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: "timeout" }), AUTH_TIMEOUT_MS);
      }),
    ]);
    if (result.kind === "timeout") {
      return { user: null, timedOut: true };
    }
    return { user: result.r.data.user, timedOut: false };
  } catch (err) {
    console.error("Supabase auth.getUser failed:", err);
    return { user: null, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing env would otherwise leave every navigation pending forever.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    const pathname = request.nextUrl.pathname;
    const isPublicRoute =
      pathname === "/login" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password" ||
      pathname.startsWith("/auth");
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { user, timedOut } = await getUserWithTimeout(() =>
    supabase.auth.getUser()
  );

  // Fail open on timeout: never redirect either direction, or a slow
  // Supabase response causes /dashboard ↔ /login redirect loops (browser spinner).
  if (timedOut) {
    console.warn(
      `Supabase auth.getUser timed out after ${AUTH_TIMEOUT_MS}ms — allowing request through`
    );
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/reset-password") {
    return supabaseResponse;
  }

  return supabaseResponse;
}
