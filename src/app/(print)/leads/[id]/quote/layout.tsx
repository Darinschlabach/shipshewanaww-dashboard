import { Suspense } from "react";

export default function QuotePrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<p className="p-8 text-gray-500">Loading quote…</p>}>{children}</Suspense>;
}
