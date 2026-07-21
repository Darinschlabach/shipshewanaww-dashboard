import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["owner", "office", "shop"];

function getRedirectOrigin(request: Request) {
  return (
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const full_name =
    typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = body.role as UserRole;

  if (!full_name || !email || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Name, email, and a valid role are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const origin = getRedirectOrigin(request);
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;

    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, role },
        redirectTo,
      });

    if (inviteError) {
      console.error("Invite email error:", inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    if (invited.user) {
      await admin
        .from("profiles")
        .update({ full_name, email, role })
        .eq("id", invited.user.id);
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: invited.user?.id,
        full_name,
        email,
        role,
      },
    });
  } catch (err) {
    console.error("Invite user failed:", err);
    const message =
      err instanceof Error ? err.message : "Server is not configured for user invitations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
