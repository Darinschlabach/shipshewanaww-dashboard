"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import AssociatedPersonForm from "@/components/AssociatedPersonForm";
import Button from "@/components/Button";
import { getAvatarColor, getInitialsFromName } from "@/lib/utils";
import {
  CONTACT_TYPES,
  type Contact,
  type ContactPerson,
  type ContactType,
} from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

const emptyPersonForm = {
  name: "",
  phone: "",
  email: "",
  positions: [] as string[],
};

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-900">{value?.trim() || "—"}</p>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [people, setPeople] = useState<ContactPerson[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    fax: "",
    address: "",
    contact_type: "Customers" as ContactType,
  });
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [savingPerson, setSavingPerson] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const syncFormFromContact = useCallback((contactData: Contact) => {
    setForm({
      name: contactData.name,
      email: contactData.email ?? "",
      phone: contactData.phone ?? "",
      fax: contactData.fax ?? "",
      address: contactData.address ?? "",
      contact_type: contactData.contact_type,
    });
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase
        .from("contact_people")
        .select("*")
        .eq("contact_id", id)
        .order("name"),
    ]);

    const contactData = c as Contact;
    setContact(contactData);
    setPeople((p as ContactPerson[]) ?? []);
    syncFormFromContact(contactData);
  }, [id, syncFormFromContact]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSavingContact(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .update({
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        fax: form.fax || null,
        address: form.address || null,
        contact_type: form.contact_type,
      })
      .eq("id", contact.id)
      .select()
      .single();

    if (data) {
      const updated = data as Contact;
      setContact(updated);
      syncFormFromContact(updated);
    }
    setSavingContact(false);
    setEditingContact(false);
  }

  function cancelContactEdit() {
    if (contact) syncFormFromContact(contact);
    setEditingContact(false);
  }

  function resetPersonForm() {
    setPersonForm(emptyPersonForm);
    setAddingPerson(false);
    setEditingPersonId(null);
  }

  function startAddPerson() {
    resetPersonForm();
    setAddingPerson(true);
  }

  function togglePersonExpanded(personId: string) {
    setExpandedPersonId((prev) => (prev === personId ? null : personId));
  }

  function startEditPerson(person: ContactPerson) {
    setAddingPerson(false);
    setEditingPersonId(person.id);
    setExpandedPersonId(null);
    setPersonForm({
      name: person.name,
      phone: person.phone ?? "",
      email: person.email ?? "",
      positions: [...person.positions],
    });
  }

  async function handleSavePerson(e: React.FormEvent) {
    e.preventDefault();
    if (!personForm.name.trim()) return;

    setSavingPerson(true);
    const supabase = createClient();
    const payload = {
      contact_id: id,
      name: personForm.name.trim(),
      phone: personForm.phone || null,
      email: personForm.email || null,
      positions: personForm.positions,
    };

    if (editingPersonId) {
      await supabase
        .from("contact_people")
        .update(payload)
        .eq("id", editingPersonId);
    } else {
      await supabase.from("contact_people").insert(payload);
    }

    resetPersonForm();
    await load();
    setSavingPerson(false);
  }

  async function handleDeleteContact() {
    if (!contact) return;
    if (
      !confirm(
        `Delete ${contact.name}? Associated people will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingContact(true);
    const supabase = createClient();
    await supabase.from("contacts").delete().eq("id", contact.id);
    router.push("/contacts");
  }

  async function handleDeletePerson(personId: string) {
    if (!confirm("Remove this person?")) return;
    const supabase = createClient();
    await supabase.from("contact_people").delete().eq("id", personId);
    if (editingPersonId === personId) {
      resetPersonForm();
    }
    load();
  }

  if (!contact) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <>
      <Link
        href="/contacts"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-burgundy"
      >
        ← All contacts
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${getAvatarColor(0)}`}
          >
            {getInitialsFromName(contact.name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{contact.name}</h1>
            <p className="text-sm text-gray-500">{contact.contact_type}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDeleteContact}
          disabled={deletingContact || savingContact}
          className="shrink-0 rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
        >
          {deletingContact ? "Deleting…" : "Delete contact"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        {/* Left — Contact details */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Contact details
            </h2>
            {!editingContact && (
              <button
                type="button"
                onClick={() => setEditingContact(true)}
                className="text-sm font-medium text-burgundy hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editingContact ? (
            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Contact Name
                </label>
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
                <label className="mb-1 block text-sm font-medium">
                  Contact Type
                </label>
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
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={savingContact}>
                  {savingContact ? "Saving…" : "Save"}
                </Button>
                <Button type="button" onClick={cancelContactEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <DetailField label="Contact Name" value={contact.name} />
              <DetailField label="Email" value={contact.email} />
              <DetailField label="Phone" value={contact.phone} />
              <DetailField label="Fax" value={contact.fax} />
              <DetailField label="Address" value={contact.address} />
              <DetailField label="Contact Type" value={contact.contact_type} />
            </div>
          )}
        </section>

        {/* Right — Associated people */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Associated People
            </h2>
            {!addingPerson && !editingPersonId && (
              <button
                type="button"
                onClick={startAddPerson}
                className="text-sm font-medium text-burgundy hover:underline"
              >
                + Add person
              </button>
            )}
          </div>

          {addingPerson && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-medium text-gray-900">New person</p>
              <AssociatedPersonForm
                values={personForm}
                saving={savingPerson}
                onChange={setPersonForm}
                onSubmit={handleSavePerson}
                onCancel={resetPersonForm}
              />
            </div>
          )}

          <div className="space-y-3">
            {people.map((person) =>
              editingPersonId === person.id ? (
                <div
                  key={person.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-gray-900">
                    Edit person
                  </p>
                  <AssociatedPersonForm
                    values={personForm}
                    saving={savingPerson}
                    onChange={setPersonForm}
                    onSubmit={handleSavePerson}
                    onCancel={resetPersonForm}
                  />
                </div>
              ) : (
                <div
                  key={person.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePersonExpanded(person.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePersonExpanded(person.id);
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <p className="font-medium text-gray-900">{person.name}</p>
                  {person.positions.length > 0 && (
                    <p className="text-sm italic text-gray-600">
                      {person.positions.join(", ")}
                    </p>
                  )}
                  {expandedPersonId === person.id && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <div className="space-y-1 text-sm text-gray-500">
                        {person.phone && <p>Phone: {person.phone}</p>}
                        {person.email && <p>Email: {person.email}</p>}
                        {!person.phone && !person.email && (
                          <p className="text-gray-400">No phone or email</p>
                        )}
                      </div>
                      <div
                        className="mt-3 flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => startEditPerson(person)}
                          disabled={addingPerson || !!editingPersonId}
                          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePerson(person.id)}
                          disabled={addingPerson || !!editingPersonId}
                          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
            {people.length === 0 && !addingPerson && (
              <p className="text-sm text-gray-500">
                No associated people yet. Click &quot;+ Add person&quot; to add
                one.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
