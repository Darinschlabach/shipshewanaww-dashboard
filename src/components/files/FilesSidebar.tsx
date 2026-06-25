"use client";

import Link from "next/link";
import {
  IconEdit,
  IconPin,
  IconShare,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  PINNED_FILES,
  RECENT_ACTIVITY,
  STORAGE_TOTAL_GB,
  STORAGE_USED_GB,
  type FileActivity,
} from "@/lib/files";

function StorageDonut() {
  const pct = Math.round((STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100);
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#6b1a2a"
            strokeWidth="10"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-900">
          {pct}%
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">
          {STORAGE_USED_GB} GB of {STORAGE_TOTAL_GB} GB
        </p>
        <Link
          href="#"
          className="text-xs font-medium text-burgundy hover:underline"
        >
          Manage storage →
        </Link>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: FileActivity["icon"] }) {
  const className = "shrink-0 text-gray-500";
  switch (type) {
    case "upload":
      return <IconUpload size={14} className={className} />;
    case "edit":
      return <IconEdit size={14} className={className} />;
    case "share":
      return <IconShare size={14} className={className} />;
    case "delete":
      return <IconTrash size={14} className={className} />;
    default:
      return <IconUpload size={14} className={className} />;
  }
}

export default function FilesSidebar() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Storage Overview</h3>
        <StorageDonut />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Pinned Files</h3>
          <Link
            href="#"
            className="text-xs font-medium text-burgundy hover:underline"
          >
            Manage
          </Link>
        </div>
        <ul className="space-y-2.5">
          {PINNED_FILES.map((file) => (
            <li key={file.id} className="flex items-center gap-2 text-sm">
              <IconPin size={14} className="shrink-0 text-amber-500" />
              <span className="truncate text-gray-800">{file.name}</span>
            </li>
          ))}
        </ul>
        <Link
          href="#"
          className="mt-3 inline-block text-xs font-medium text-burgundy hover:underline"
        >
          View all pinned →
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
          <Link
            href="#"
            className="text-xs font-medium text-burgundy hover:underline"
          >
            View all
          </Link>
        </div>
        <ul className="space-y-3">
          {RECENT_ACTIVITY.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <ActivityIcon type={item.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{item.fileName}</p>
                <p className="text-xs text-gray-500">
                  {item.action} {item.actor}
                </p>
                <p className="text-xs text-gray-400">{item.timestamp}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
