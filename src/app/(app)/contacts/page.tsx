"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import ContactsMapModal from "@/components/ContactsMapModal";
import { getAvatarColor, getInitialsFromName } from "@/lib/utils";
import { CONTACT_TYPES, type Contact, type ContactType } from "@/lib/types";

type TypeFilter = "All" | ContactType;

const TYPE_FILTERS: TypeFilter[] = [
  "All",
  "Contractors",
  "Customers",
  "Employees",
  "Vendors",
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  fax: "",
  address: "",
  contact_type: "Customers" as ContactType,
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<(Contact & { job_count: number })[]>(
    []
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .order("name");

    const withCounts = await Promise.all(
      (contactsData ?? []).map(async (c) => {
        const { count } = await supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", c.id);
        return { ...c, job_count: count ?? 0 };
      })
    );

    setContacts(withCounts as (Contact & { job_count: number })[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts
      .filter((c) => {
        if (typeFilter !== "All" && c.contact_type !== typeFilter) {
          return false;
        }
        return (
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.includes(q) ?? false) ||
          (c.fax?.includes(q) ?? false) ||
          (c.address?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
  }, [contacts, search, typeFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("contacts").insert({
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      fax: form.fax || null,
      address: form.address || null,
      contact_type: form.contact_type,
    });
    setShowModal(false);
    setForm(emptyForm);
    load();
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        rightSlot={
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-900 bg-white text-gray-900 hover:bg-gray-50"
              aria-label="View contacts on map"
            >
              <MapPin className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-md border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              + New contact
            </button>
          </div>
        }
      />

      <input
        type="search"
        placeholder="Search contacts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((filter) => {
          const active = typeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setTypeFilter(filter)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border border-[#6B1A2A] bg-[#6B1A2A] text-white"
                  : "border border-gray-900 bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((contact, i) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarColor(i)}`}
              >
                {getInitialsFromName(contact.name)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{contact.name}</p>
                <p className="text-sm text-gray-500">
                  {contact.job_count} job{contact.job_count !== 1 ? "s" : ""}
                  {contact.email && ` · ${contact.email}`}
                  {contact.phone && ` · ${contact.phone}`}
                </p>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500">No contacts match your filters.</p>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="New contact" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Contact Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fax</label>
              <input
                value={form.fax}
                onChange={(e) => setForm({ ...form, fax: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Address</label>
              <AddressAutocomplete
                value={form.address}
                onChange={(address) => setForm({ ...form, address })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contact Type</label>
              <select
                required
                value={form.contact_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contact_type: e.target.value as ContactType,
                  })
                }
                className={inputClass}
              >
                {CONTACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create contact
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showMap && (
        <ContactsMapModal contacts={contacts} onClose={() => setShowMap(false)} />
      )}
    </>
  );
}
