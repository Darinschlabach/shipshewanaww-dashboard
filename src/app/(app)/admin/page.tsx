"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconSearch,
  IconPlus,
  IconDots,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import type { Profile, UserRole } from "@/lib/types";

type AdminRole =
  | "Administrator"
  | "Office"
  | "Shop"
  | "Drafting"
  | "Finishing"
  | "Purchasing"
  | "Accounting"
  | "Delivery";

type UserModalState =
  | { mode: "create" }
  | { mode: "edit"; user: AdminUser }
  | null;

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: AdminRole;
  dbRole: UserRole;
  active: boolean;
  last_login: string;
  is_current_user?: boolean;
}

const ROLE_OPTIONS: { value: UserRole; label: AdminRole }[] = [
  { value: "owner", label: "Administrator" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" },
];

const ROLE_STYLES: Record<AdminRole, string> = {
  Administrator: "bg-purple-100 text-purple-700",
  Office: "bg-blue-100 text-blue-700",
  Shop: "bg-green-100 text-green-700",
  Drafting: "bg-amber-100 text-amber-700",
  Finishing: "bg-violet-100 text-violet-700",
  Purchasing: "bg-orange-100 text-orange-700",
  Accounting: "bg-sky-100 text-sky-700",
  Delivery: "bg-rose-100 text-rose-700",
};

const AVATAR_PALETTE = [
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
];

function roleLabel(role: UserRole): AdminRole {
  if (role === "owner") return "Administrator";
  if (role === "office") return "Office";
  return "Shop";
}

function profileToAdminUser(profile: Profile, currentUserId: string | null): AdminUser {
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: roleLabel(profile.role),
    dbRole: profile.role,
    active: true,
    last_login: "—",
    is_current_user: profile.id === currentUserId,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [userModal, setUserModal] = useState<UserModalState>(null);
  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    role: "office" as UserRole,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (fetchError) {
      setError(fetchError.message);
      setUsers([]);
      setIsOwner(false);
    } else {
      const profiles = (data as Profile[]) ?? [];
      const currentProfile = profiles.find((p) => p.id === user?.id);
      setIsOwner(currentProfile?.role === "owner");
      setUsers(
        profiles.map((profile) =>
          profileToAdminUser(profile, user?.id ?? null),
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter(
      (u) =>
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
    return [...list].sort((a, b) => {
      const cmp = a.full_name.localeCompare(b.full_name);
      return sortAsc ? cmp : -cmp;
    });
  }, [query, sortAsc, users]);

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Failed to delete user");
      setDeleting(false);
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
    setOpenMenu(null);
    setDeleting(false);
  }

  function openCreate() {
    setUserForm({ full_name: "", email: "", role: "office" });
    setFormError(null);
    setSuccess(null);
    setUserModal({ mode: "create" });
  }

  function openEdit(user: AdminUser) {
    setUserForm({
      full_name: user.full_name,
      email: user.email,
      role: user.dbRole,
    });
    setFormError(null);
    setUserModal({ mode: "edit", user });
    setOpenMenu(null);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userModal) return;

    setSaving(true);
    setFormError(null);
    setError(null);
    setSuccess(null);

    const isCreate = userModal.mode === "create";
    const res = await fetch(
      isCreate
        ? "/api/admin/users"
        : `/api/admin/users/${userModal.user.id}`,
      {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      },
    );
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setFormError(body.error ?? `Failed to ${isCreate ? "invite" : "update"} user`);
      setSaving(false);
      return;
    }

    if (isCreate) {
      setSuccess(
        `Invite email sent to ${userForm.email}. They can set their password using the link.`,
      );
      await load();
      setUserModal(null);
    } else {
      const updatedRole = body.user.role as UserRole;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userModal.user.id
            ? {
                ...u,
                full_name: userForm.full_name,
                email: userForm.email,
                dbRole: updatedRole,
                role: roleLabel(updatedRole),
              }
            : u,
        ),
      );
      setUserModal(null);
    }

    setSaving(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage user accounts, roles and permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-56 rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <IconPlus size={16} />
            New User
          </button>
        </div>
      </div>

      {success && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3.5">
                  <button
                    onClick={() => setSortAsc((s) => !s)}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700"
                  >
                    Name
                    {sortAsc ? (
                      <IconArrowUp size={14} />
                    ) : (
                      <IconArrowDown size={14} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    Loading users…
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
                            user.full_name,
                          )}`}
                        >
                          {initials(user.full_name)}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {user.full_name}
                          </span>
                          {user.is_current_user && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                              You
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_STYLES[user.role]
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.active ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <span
                          className={
                            user.active ? "text-green-600" : "text-gray-400"
                          }
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.last_login}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowMenu
                        open={openMenu === user.id}
                        canDelete={!user.is_current_user}
                        isActive={user.active}
                        onToggle={() =>
                          setOpenMenu((cur) =>
                            cur === user.id ? null : user.id,
                          )
                        }
                        onClose={() => setOpenMenu(null)}
                        onEdit={() => openEdit(user)}
                        onDeactivate={() => {
                          setUsers((prev) =>
                            prev.map((u) =>
                              u.id === user.id
                                ? { ...u, active: !u.active }
                                : u,
                            ),
                          );
                          setOpenMenu(null);
                        }}
                        onDelete={() => {
                          setDeleteTarget(user);
                          setOpenMenu(null);
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {userModal && (
        <Modal
          title={userModal.mode === "create" ? "New user" : "Edit user"}
          onClose={() => {
            if (!saving) setUserModal(null);
          }}
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Full name</label>
              <input
                required
                value={userForm.full_name}
                onChange={(e) =>
                  setUserForm({ ...userForm, full_name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {userModal.mode === "create" && (
                <p className="mt-1 text-xs text-gray-500">
                  They will sign in using this email address.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    role: e.target.value as UserRole,
                  })
                }
                disabled={userModal.mode === "edit" && !isOwner}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {userModal.mode === "edit" && !isOwner && (
                <p className="mt-1 text-xs text-gray-500">
                  Only administrators can change roles.
                </p>
              )}
            </div>
            {userModal.mode === "create" && (
              <p className="text-sm text-gray-500">
                An email will be sent with a setup link so they can create their
                password.
              </p>
            )}
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setUserModal(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? userModal.mode === "create"
                    ? "Sending…"
                    : "Saving…"
                  : userModal.mode === "create"
                    ? "Send invite"
                    : "Save changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user"
          body={`This will permanently delete ${deleteTarget.full_name} and invalidate their login credentials. This cannot be undone.`}
          confirmLabel="Delete user"
          loading={deleting}
          onConfirm={handleDeleteUser}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

function RowMenu({
  open,
  canDelete,
  isActive,
  onToggle,
  onClose,
  onEdit,
  onDeactivate,
  onDelete,
}: {
  open: boolean;
  canDelete: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={onToggle}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <IconDots size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg">
            <button
              onClick={onEdit}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit user
            </button>
            <button
              onClick={onDeactivate}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {isActive ? "Deactivate user" : "Reactivate user"}
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete user
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
