interface MetricCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
}

export default function MetricCard({ label, value, subLabel }: MetricCardProps) {
  return (
    <div className="rounded-lg bg-cream px-5 py-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {subLabel && (
        <p className="mt-0.5 text-sm text-gray-500">{subLabel}</p>
      )}
    </div>
  );
}
