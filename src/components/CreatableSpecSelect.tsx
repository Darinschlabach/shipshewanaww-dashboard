"use client";

import { useEffect, useState } from "react";

const ADD_NEW_VALUE = "__add_new__";

interface CreatableSpecSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddOption: (name: string) => Promise<string | null>;
  placeholder?: string;
}

export default function CreatableSpecSelect({
  label,
  value,
  options,
  onChange,
  onAddOption,
  placeholder = "Select…",
}: CreatableSpecSelectProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) {
      setNewName("");
      setError(null);
    }
  }, [adding]);

  async function handleAddNew() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }

    setSaving(true);
    setError(null);
    const saved = await onAddOption(trimmed);
    setSaving(false);

    if (!saved) {
      setError("Could not save. Try again.");
      return;
    }

    onChange(saved);
    setAdding(false);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {!adding ? (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === ADD_NEW_VALUE) {
              setAdding(true);
              return;
            }
            onChange(e.target.value);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={ADD_NEW_VALUE}>+ Add new…</option>
        </select>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${label.toLowerCase()}`}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddNew();
              }
            }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAddNew()}
              disabled={saving}
              className="rounded-md bg-burgundy px-3 py-1.5 text-xs font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
