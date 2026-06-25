import {
  IconCheck,
  IconClock,
  type TablerIcon,
} from "@tabler/icons-react";
import Link from "next/link";

type TrackStatus = "done" | "in_progress" | "pending";

interface TrackRowProps {
  icon: TablerIcon;
  label: string;
  detail: string;
  status: TrackStatus;
  href?: string;
  onClick?: () => void;
}

function StatusIcon({ status }: { status: TrackStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
        <IconCheck size={16} stroke={2.5} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white">
        <IconClock size={16} stroke={2} />
      </span>
    );
  }
  return <span className="h-7 w-7 rounded-full border-2 border-gray-300" />;
}

export default function TrackRow({
  icon: Icon,
  label,
  detail,
  status,
  href,
  onClick,
}: TrackRowProps) {
  const interactive = href || onClick;
  const content = (
    <div
      className={`flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 ${
        interactive
          ? "cursor-pointer transition-colors hover:border-gray-300 hover:bg-gray-50"
          : ""
      }`}
    >
      <Icon size={20} className="shrink-0 text-gray-500" stroke={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <StatusIcon status={status} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block w-full">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {content}
      </button>
    );
  }
  return <div className="w-full">{content}</div>;
}
