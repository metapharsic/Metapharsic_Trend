"use client";

import React from "react";
import { Search, X } from "lucide-react";

export interface ScrollSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  matchedCount?: number;
  totalCount?: number;
  className?: string;
  accent?: "emerald" | "purple" | "indigo" | "slate";
}

/**
 * Compact live filter bar placed above scrollable pickers, checklists, and modal tables
 * so users never have to hunt through long scrolled lists manually.
 */
export function ScrollSearchBar({
  value,
  onChange,
  placeholder = "Search list…",
  matchedCount,
  totalCount,
  className = "",
  accent = "indigo",
}: ScrollSearchBarProps) {
  const ringClass =
    accent === "purple"
      ? "focus:ring-purple-500 border-purple-200"
      : accent === "emerald"
      ? "focus:ring-emerald-500 border-emerald-200"
      : accent === "slate"
      ? "focus:ring-slate-400 border-slate-200"
      : "focus:ring-indigo-500 border-slate-200";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`w-full bg-white border ${ringClass} rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {typeof matchedCount === "number" && typeof totalCount === "number" && (
        <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap tabular-nums">
          {value.trim() ? `${matchedCount} of ${totalCount}` : `${totalCount}`}
        </span>
      )}
    </div>
  );
}
