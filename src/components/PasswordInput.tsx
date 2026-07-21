"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  className?: string;
}

export default function PasswordInput({
  className = "",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? (
          <IconEyeOff size={18} stroke={1.5} />
        ) : (
          <IconEye size={18} stroke={1.5} />
        )}
      </button>
    </div>
  );
}
