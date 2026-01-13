"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

type SettingsSectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export default function SettingsSection({
  title,
  isOpen,
  onToggle,
  children,
}: SettingsSectionProps) {
  return (
    <div className="border border-border dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark-light overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
        aria-expanded={isOpen}
        aria-controls={`settings-section-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-secondary dark:text-secondary-dark" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-secondary dark:text-secondary-dark" />
        )}
      </button>
      <div
        id={`settings-section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 border-t border-border dark:border-border-dark">
          {children}
        </div>
      </div>
    </div>
  );
}
