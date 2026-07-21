import { DRAFTING_FOR_ALL_ROOMS, DRAFTING_FOR_MISC } from "@/lib/types";

const ROOM_PILL_PALETTE = [
  "bg-blue-50 text-blue-700",
  "bg-violet-50 text-violet-700",
  "bg-amber-50 text-amber-700",
  "bg-emerald-50 text-emerald-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
  "bg-orange-50 text-orange-700",
  "bg-indigo-50 text-indigo-700",
  "bg-teal-50 text-teal-700",
  "bg-fuchsia-50 text-fuchsia-700",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function roomPillStyle(forRoom: string): string {
  if (forRoom === DRAFTING_FOR_MISC) {
    return "bg-gray-100 text-gray-700";
  }
  if (forRoom === DRAFTING_FOR_ALL_ROOMS) {
    return "bg-slate-100 text-slate-700";
  }
  const index = hashString(forRoom) % ROOM_PILL_PALETTE.length;
  return ROOM_PILL_PALETTE[index];
}
