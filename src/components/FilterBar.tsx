"use client";

interface FilterBarProps {
  options: { value: string; label: string }[];
  activeOption: string;
  onChange: (value: string) => void;
  rightSlot?: React.ReactNode;
}

export default function FilterBar({
  options,
  activeOption,
  onChange,
  rightSlot,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              activeOption === opt.value
                ? "border-gray-900 bg-white text-gray-900"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {rightSlot}
    </div>
  );
}
