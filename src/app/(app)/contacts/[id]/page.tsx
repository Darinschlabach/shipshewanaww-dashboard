"use client";

import { useParams } from "next/navigation";
import ContactDetailPanel from "@/components/contacts/ContactDetailPanel";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();

  return <ContactDetailPanel contactId={id} variant="page" />;
}
