import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["owner", "office", "shop"];

async function authorize(
  targetUserId: string,
  requestedRole?: UserRole,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isSelf = user.id === targetUserId;
  const isOwner = callerProfile?.role === "owner";

  if (!isSelf && !isOwner) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (requestedRole) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", targetUserId)
      .single();

    if (
      requestedRole !== targetProfile?.role &&
      !isOwner
    ) {
      return {
        error: NextResponse.json(
          { error: "Only administrators can change roles" },
          { status: 403 },
        ),
      };
    }
  }

  return { supabase, user, isSelf, isOwner };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params;
  const body = await request.json();
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = body.role as UserRole;

  if (!full_name || !email || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Name, email, and a valid role are required" },
      { status: 400 },
    );
  }

  const auth = await authorize(targetUserId, role);
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, user, isSelf } = auth;

  try {
    if (isSelf) {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", targetUserId)
        .single();

      if (email !== currentProfile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) {
          return NextResponse.json({ error: emailError.message }, { status: 500 });
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name, email, role })
        .eq("id", targetUserId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    } else {
      const admin = createAdminClient();

      const { error: authError } = await admin.auth.admin.updateUserById(
        targetUserId,
        {
          email,
          user_metadata: { full_name, role },
        },
      );

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ full_name, email, role })
        .eq("id", targetUserId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      user: { id: targetUserId, full_name, email, role },
    });
  } catch {
    return NextResponse.json(
      { error: "Server is not configured for user updates" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.id === targetUserId) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
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
    const { error } = await admin.auth.admin.deleteUser(targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Server is not configured for user deletion" },
      { status: 500 },
    );
  }
}
