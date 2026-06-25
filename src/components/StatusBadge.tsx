import { leadStatusLabel, poStatusLabel } from "@/lib/utils";

type Status =
  | "not_ordered"
  | "ordered"
  | "delivered"
  | "archived"
  | "new_inquiry"
  | "quote_sent"
  | "draft"
  | "sent"
  | "revision"
  | "approved"
  | "lost"
  | "converted";

const styles: Record<Status, string> = {
  not_ordered: "bg-blue-100 text-blue-800",
  ordered: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
  new_inquiry: "bg-gray-100 text-gray-700",
  quote_sent: "bg-blue-100 text-blue-800",
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  revision: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  converted: "bg-green-100 text-green-800",
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label =
    status === "new_inquiry" ||
    status === "quote_sent" ||
    status === "draft" ||
    status === "sent" ||
    status === "revision" ||
    status === "approved" ||
    status === "lost" ||
    status === "converted"
      ? leadStatusLabel(status)
      : poStatusLabel(status);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {label}
    </span>
  );
}
