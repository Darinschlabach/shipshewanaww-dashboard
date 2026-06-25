import type { UserRole } from "@/lib/types";

const styles: Record<UserRole, string> = {
  owner: "bg-amber-100 text-amber-800",
  shop: "bg-green-100 text-green-800",
  office: "bg-blue-100 text-blue-800",
};

const labels: Record<UserRole, string> = {
  owner: "Owner",
  shop: "Shop",
  office: "Office",
};

interface RoleBadgeProps {
  role: UserRole;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[role]}`}
    >
      {labels[role]}
    </span>
  );
}
