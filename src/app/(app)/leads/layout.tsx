import { Suspense } from "react";

export default function LeadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<p className="text-gray-500">Loading…</p>}>{children}</Suspense>;
}
