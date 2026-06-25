import Link from "next/link";

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export default function PageHeader({
  title,
  actionLabel,
  onAction,
  actionHref,
  subtitle,
  rightSlot,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {rightSlot ??
        (actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="shrink-0 rounded-md border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            {actionLabel}
          </Link>
        ) : actionLabel && onAction ? (
          <button
            onClick={onAction}
            className="shrink-0 rounded-md border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            {actionLabel}
          </button>
        ) : null)}
    </div>
  );
}
