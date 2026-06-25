import { IconAlertTriangle, IconClock } from "@tabler/icons-react";

interface AlertBannerProps {
  type: "warn" | "info";
  message: string;
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  const isWarn = type === "warn";
  return (
    <div
      className={`mb-3 flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
        isWarn
          ? "bg-amber-50 text-amber-900"
          : "bg-blue-50 text-blue-900"
      }`}
    >
      {isWarn ? (
        <IconAlertTriangle size={18} className="shrink-0 text-amber-600" />
      ) : (
        <IconClock size={18} className="shrink-0 text-blue-600" />
      )}
      <span>{message}</span>
    </div>
  );
}
