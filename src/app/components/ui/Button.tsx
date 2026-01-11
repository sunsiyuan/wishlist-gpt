import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200",
  secondary:
    "bg-white border border-border text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2 dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200 dark:hover:bg-background-dark",
  ghost:
    "bg-transparent text-secondary hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2 dark:text-secondary-dark dark:hover:text-primary-dark dark:hover:bg-background-dark-light",
  danger:
    "bg-error/10 text-error hover:bg-error/20 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 dark:bg-error-dark/20 dark:text-error-dark dark:hover:bg-error-dark/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
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
  const baseStyles =
    "font-semibold rounded-pill cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <button
      className={`${baseStyles} ${variantStyle} ${sizeStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
