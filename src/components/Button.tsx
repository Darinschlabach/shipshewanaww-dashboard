interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "small";
}

export default function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "rounded-md text-sm font-medium transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-burgundy px-4 py-2 text-white hover:bg-burgundy/90",
    secondary:
      "border border-gray-900 bg-white px-4 py-2 text-gray-900 hover:bg-gray-50",
    small:
      "border border-gray-300 bg-white px-3 py-1.5 text-gray-900 hover:bg-gray-50",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
