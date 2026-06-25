"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import type { Contact } from "@/lib/types";

interface ContactSearchSelectProps {
  contacts: Contact[];
  value: string | null;
  onChange: (contactId: string | null, contact: Contact | null) => void;
  required?: boolean;
  excludeIds?: string[];
  placeholder?: string;
}

export default function ContactSearchSelect({
  contacts,
  value,
  onChange,
  required,
  excludeIds = [],
  placeholder = "Search contacts…",
}: ContactSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => contacts.find((c) => c.id === value) ?? null,
    [contacts, value]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const excluded = new Set(excludeIds);
    const available = contacts.filter((c) => !excluded.has(c.id));
    const list = q
      ? available.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.email?.toLowerCase().includes(q) ?? false) ||
            (c.phone?.includes(q) ?? false)
        )
      : available;
    return list.slice(0, 10);
  }, [contacts, query, excludeIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectContact(contact: Contact) {
    onChange(contact.id, contact);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange(null, null);
    setQuery("");
  }

  if (selected && !open) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {selected.name}
          </p>
          {(selected.phone || selected.email) && (
            <p className="truncate text-xs text-gray-500">
              {[selected.phone, selected.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          aria-label="Clear contact"
        >
          <IconX size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <IconSearch
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required && !value}
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
        />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">
              No contacts match. Add them under Contacts first.
            </li>
          ) : (
            filtered.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => selectContact(contact)}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {contact.name}
                  </span>
                  {(contact.phone || contact.email) && (
                    <span className="text-xs text-gray-500">
                      {[contact.phone, contact.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {required && !value && (
        <p className="mt-1 text-xs text-gray-500">
          Select a contact from your address book.
        </p>
      )}
    </div>
  );
}
