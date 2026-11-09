"use client";

interface FilterPillsProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Same pills as the Quotes page: All Quotes, Draft (27), Sent (0). */
export default function FilterPills({ options, value, onChange }: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              active
                ? "border-burgundy bg-white text-burgundy"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
