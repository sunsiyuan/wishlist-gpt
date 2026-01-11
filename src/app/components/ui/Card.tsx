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
    "bg-background-light rounded-card p-4 shadow-card dark:bg-background-dark-light dark:shadow-card-dark";
  const interactiveStyles = interactive
    ? "cursor-pointer hover:shadow-lg transition-shadow duration-200"
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
