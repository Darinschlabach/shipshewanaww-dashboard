"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import RoleBadge from "@/components/RoleBadge";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import type { Profile, UserRole } from "@/lib/types";

const PERMISSIONS = [
  { key: "view_jobs", label: "View all jobs" },
  { key: "quotes", label: "Create / edit quotes" },
  { key: "financials", label: "View financials" },
  { key: "production", label: "Move production stages" },
  { key: "users", label: "Manage users" },
] as const;

const MATRIX: Record<(typeof PERMISSIONS)[number]["key"], Record<UserRole, boolean>> = {
  view_jobs: { owner: true, office: true, shop: true },
  quotes: { owner: true, office: true, shop: false },
  financials: { owner: true, office: true, shop: false },
  production: { owner: true, office: false, shop: true },
  users: { owner: true, office: false, shop: false },
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "office" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    setProfiles((data as Profile[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, role: form.role },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ full_name: form.full_name, role: form.role })
        .eq("id", data.user.id);
    }
    setShowModal(false);
    setForm({ email: "", password: "", full_name: "", role: "office" });
    load();
  }

  return (
    <>
      <PageHeader
        title="Admin — user management"
        actionLabel="+ Add user"
        onAction={() => setShowModal(true)}
      />

      <div className="mb-8 space-y-3">
        {profiles.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-4"
          >
            <div>
              <p className="font-medium text-gray-900">{user.full_name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="text-sm text-gray-500">
            No users yet. Add a user or sign in to create your profile.
          </p>
        )}
      </div>

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        Role permissions
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Permission
              </th>
              {(["owner", "office", "shop"] as UserRole[]).map((r) => (
                <th
                  key={r}
                  className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500"
                >
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm) => (
              <tr key={perm.key} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{perm.label}</td>
                {(["owner", "office", "shop"] as UserRole[]).map((role) => (
                  <td key={role} className="px-4 py-3 text-center">
                    {MATRIX[perm.key][role] ? (
                      <IconCheck
                        size={18}
                        className="mx-auto text-green-600"
                        stroke={2}
                      />
                    ) : (
                      <IconMinus
                        size={18}
                        className="mx-auto text-gray-300"
                        stroke={2}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add user" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Full name</label>
              <input
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as UserRole })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="owner">Owner</option>
                <option value="office">Office</option>
                <option value="shop">Shop</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Add user
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
