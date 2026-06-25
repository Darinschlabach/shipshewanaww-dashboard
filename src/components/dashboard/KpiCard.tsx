import Link from "next/link";
import { formatCurrencyFull } from "@/lib/utils";

interface KpiCardProps {
  icon: React.ComponentType<{ size?: number; className?: string; stroke?: number }>;
  iconClass: string;
  label: string;
  count: number;
  countLabel: string;
  value: number;
  valueLabel: string;
  href: string;
  viewLabel: string;
}

export default function KpiCard({
  icon: Icon,
  iconClass,
  label,
  count,
  countLabel,
  value,
  valueLabel,
  href,
  viewLabel,
}: KpiCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <Icon size={22} className={iconClass} stroke={1.5} />
        <Link href={href} className="text-xs font-medium text-burgundy hover:underline">
          {viewLabel}
        </Link>
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{count}</p>
      <p className="text-xs text-gray-500">{countLabel}</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">
        {formatCurrencyFull(value)}
      </p>
      <p className="text-xs text-gray-500">{valueLabel}</p>
    </div>
  );
}
