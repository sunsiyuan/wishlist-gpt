import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  // High-contrast default: ink on light, paper on dark.
  primary:
    "bg-primary text-white hover:bg-primary/90 dark:bg-primary-dark dark:text-black dark:hover:bg-white/90",
  // The one accent — reserve for the single primary action in a view.
  accent: "bg-accent text-accent-fg hover:opacity-90",
  secondary:
    "bg-background-light border border-border text-primary hover:bg-background dark:bg-background-dark-light dark:border-border-dark dark:text-primary-dark dark:hover:bg-background-dark",
  ghost:
    "bg-transparent text-secondary hover:text-primary hover:bg-background dark:text-secondary-dark dark:hover:text-primary-dark dark:hover:bg-background-dark-light",
  danger:
    "bg-error/10 text-error hover:bg-error/15 dark:bg-error-dark/15 dark:text-error-dark dark:hover:bg-error-dark/25",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  // One radius for every button (rounded-button). No pill/lg/xl/full mix.
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-button cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
