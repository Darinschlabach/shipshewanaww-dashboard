"use client";

import Button from "@/components/Button";
import { ASSOCIATED_POSITIONS } from "@/lib/types";

export type PersonFormValues = {
  name: string;
  phone: string;
  email: string;
  positions: string[];
};

interface AssociatedPersonFormProps {
  values: PersonFormValues;
  saving: boolean;
  onChange: (values: PersonFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export default function AssociatedPersonForm({
  values,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: AssociatedPersonFormProps) {
  function togglePosition(position: string) {
    onChange({
      ...values,
      positions: values.positions.includes(position)
        ? values.positions.filter((p) => p !== position)
        : [...values.positions, position],
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Name</label>
        <input
          required
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Phone</label>
        <input
          value={values.phone}
          onChange={(e) => onChange({ ...values, phone: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          value={values.email}
          onChange={(e) => onChange({ ...values, email: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Position</p>
        <div className="space-y-2">
          {ASSOCIATED_POSITIONS.map((position) => (
            <label
              key={position}
              className="flex cursor-pointer items-center gap-2 text-sm text-gray-900"
            >
              <input
                type="checkbox"
                checked={values.positions.includes(position)}
                onChange={() => togglePosition(position)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {position}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
