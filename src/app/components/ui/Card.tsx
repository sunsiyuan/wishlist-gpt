import { type HTMLAttributes, type ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export default function Card({
  children,
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  const baseStyles =
    "bg-background-light rounded-card p-4 border border-border dark:bg-background-dark-light dark:border-border-dark";
  const interactiveStyles = interactive
    ? "cursor-pointer hover:shadow-card hover:-translate-y-0.5 dark:hover:shadow-card-dark transition-all duration-150"
    : "";

  return (
    <div
      className={`${baseStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
