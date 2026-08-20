"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconPencil } from "@tabler/icons-react";

interface CreatableSpecSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddOption: (name: string) => Promise<string | null>;
  onRenameOption?: (oldName: string, newName: string) => Promise<string | null>;
  placeholder?: string;
}

export default function CreatableSpecSelect({
  label,
  value,
  options,
  onChange,
  onAddOption,
  onRenameOption,
  placeholder = "Select…",
}: CreatableSpecSelectProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditingOption(null);
        setEditName("");
        setError(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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

  function startEditingOption(option: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setEditingOption(option);
    setEditName(option);
    setError(null);
  }

  async function handleRenameOption() {
    if (!editingOption || !onRenameOption) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }

    setRenaming(true);
    setError(null);
    const saved = await onRenameOption(editingOption, trimmed);
    setRenaming(false);

    if (!saved) {
      setError("Could not save. Try again.");
      return;
    }

    if (value === editingOption) {
      onChange(saved);
    }
    setEditingOption(null);
    setEditName("");
  }

  function handleSelectOption(option: string) {
    onChange(option);
    setOpen(false);
    setEditingOption(null);
    setEditName("");
    setError(null);
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {!adding ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-gray-400"
          >
            <span className={value ? "text-gray-900" : "text-gray-500"}>
              {value || placeholder}
            </span>
            <IconChevronDown
              size={16}
              className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open ? (
            <div className="absolute z-[60] mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => handleSelectOption("")}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-600 hover:text-white ${
                  !value ? "bg-blue-600 text-white" : "text-gray-900"
                }`}
              >
                {placeholder}
              </button>

              {options.map((option) =>
                editingOption === option ? (
                  <div
                    key={option}
                    className="flex items-center gap-1 px-2 py-1"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleRenameOption();
                        }
                        if (event.key === "Escape") {
                          setEditingOption(null);
                          setEditName("");
                          setError(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleRenameOption()}
                      disabled={renaming}
                      title="Save"
                      className="shrink-0 rounded p-1 text-burgundy hover:bg-burgundy/10 disabled:opacity-50"
                    >
                      <IconCheck size={16} stroke={2.5} />
                    </button>
                  </div>
                ) : (
                  <div
                    key={option}
                    className={`group flex items-center ${
                      value === option ? "bg-blue-600 text-white" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectOption(option)}
                      className={`min-w-0 flex-1 px-3 py-1.5 text-left text-sm ${
                        value === option
                          ? "text-white"
                          : "text-gray-900 group-hover:bg-blue-600 group-hover:text-white"
                      }`}
                    >
                      {option}
                    </button>
                    {onRenameOption ? (
                      <button
                        type="button"
                        onClick={(event) => startEditingOption(option, event)}
                        title="Edit name"
                        className={`mr-1 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                          value === option
                            ? "text-white hover:bg-white/20"
                            : "text-gray-500 hover:bg-blue-700 hover:text-white"
                        }`}
                      >
                        <IconPencil size={14} />
                      </button>
                    ) : null}
                  </div>
                )
              )}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setAdding(true);
                  setEditingOption(null);
                  setEditName("");
                  setError(null);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-gray-900 hover:bg-blue-600 hover:text-white"
              >
                + Add new…
              </button>

              {error ? (
                <p className="px-3 py-1 text-xs text-red-600">{error}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={`New ${label.toLowerCase()}`}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAddNew();
              }
            }}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
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
