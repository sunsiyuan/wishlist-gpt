"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const htmlElement = document.documentElement;
    const isDarkMode = htmlElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const htmlElement = document.documentElement;
    const newIsDark = !htmlElement.classList.contains("dark");
    
    if (newIsDark) {
      htmlElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      htmlElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    
    setIsDark(newIsDark);
  };

  useEffect(() => {
    if (!mounted) return;
    
    const storedTheme = localStorage.getItem("theme");
    const htmlElement = document.documentElement;
    
    if (storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      htmlElement.classList.add("dark");
      setIsDark(true);
    } else {
      htmlElement.classList.remove("dark");
      setIsDark(false);
    }
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-between py-3 px-4 border border-border dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark-light">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark mode</span>
        <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 border border-border dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark-light">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark mode</span>
      <button
        type="button"
        onClick={toggleDarkMode}
        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {isDark ? (
            <SunIcon className="h-4 w-4 text-gray-700" />
          ) : (
            <MoonIcon className="h-4 w-4 text-gray-700" />
          )}
        </span>
      </button>
    </div>
  );
}
