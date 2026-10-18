"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { Search, ChevronDown, Check, X, Filter } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
  group?: string;
}

export interface SearchableSelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: any) => void;
  onValueChange?: (value: string) => void;
  options?: SearchableOption[];
  children?: ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  allowClear?: boolean;
  showCount?: boolean;
  align?: "left" | "right";
  "data-testid"?: string;
  renderOption?: (option: SearchableOption, isSelected: boolean) => ReactNode;
}

/**
 * Helper to recursively extract text content from React children
 */
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (React.isValidElement(node) && node.props) {
    const props = node.props as { children?: ReactNode };
    if (props.children) {
      return extractText(props.children);
    }
  }
  return "";
}

/**
 * Universal Searchable & Filterable Select Component
 * ===================================================
 * Seamless drop-in replacement for native <select> elements across all Trend MR pages and roles.
 * Features:
 * - Live instant search and keyword filtering.
 * - Supports both `options` prop and standard `<option>`/`<optgroup>` children.
 * - Keyboard navigation (Up/Down/Enter/Escape).
 * - Click-outside dismiss & accessible focus management.
 * - Underlying hidden <select> to preserve HTML form submissions and automated testing.
 */
export function SearchableSelect({
  value: controlledValue,
  defaultValue,
  onChange,
  onValueChange,
  options: providedOptions,
  children,
  placeholder = "Select...",
  searchPlaceholder = "Type to search / filter...",
  name,
  id,
  disabled = false,
  required = false,
  className = "",
  buttonClassName = "",
  dropdownClassName = "",
  allowClear = false,
  showCount = true,
  align = "left",
  "data-testid": dataTestId,
  renderOption,
}: SearchableSelectProps) {
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (controlledValue !== undefined) return String(controlledValue);
    if (defaultValue !== undefined) return String(defaultValue);
    return "";
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Sync controlled value
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(String(controlledValue));
    }
  }, [controlledValue]);

  // Parse options from children if `options` prop not provided or to merge
  const parsedChildOptions = useMemo<SearchableOption[]>(() => {
    if (!children) return [];

    const extracted: SearchableOption[] = [];

    const processChild = (child: ReactNode, currentGroup?: string) => {
      if (!React.isValidElement(child)) return;

      if (child.type === "option") {
        const props = child.props as {
          value?: any;
          children?: ReactNode;
          disabled?: boolean;
        };
        const optVal =
          props.value !== undefined
            ? String(props.value)
            : extractText(props.children);
        const optLabel = props.children
          ? extractText(props.children)
          : optVal;

        extracted.push({
          value: optVal,
          label: optLabel || optVal,
          disabled: Boolean(props.disabled),
          group: currentGroup,
        });
      } else if (child.type === "optgroup") {
        const props = child.props as {
          label?: string;
          children?: ReactNode;
        };
        const groupLabel = props.label || "Group";
        React.Children.forEach(props.children, (nested) =>
          processChild(nested, groupLabel)
        );
      } else if (child.props && (child.props as any).children) {
        // In case options are inside a Fragment or wrapper
        React.Children.forEach((child.props as any).children, (nested) =>
          processChild(nested, currentGroup)
        );
      }
    };

    React.Children.forEach(children, (child) => processChild(child));
    return extracted;
  }, [children]);

  // Resolved final options list
  const allOptions = useMemo<SearchableOption[]>(() => {
    if (providedOptions && providedOptions.length > 0) {
      return providedOptions;
    }
    return parsedChildOptions;
  }, [providedOptions, parsedChildOptions]);

  // Current active value
  const currentValue = controlledValue !== undefined ? String(controlledValue) : internalValue;

  // Selected option details
  const selectedOption = useMemo(() => {
    return allOptions.find((o) => o.value === currentValue);
  }, [allOptions, currentValue]);

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return allOptions;
    const query = searchTerm.toLowerCase().trim();
    return allOptions.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchValue = opt.value.toLowerCase().includes(query);
      const matchSub = opt.sublabel?.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      const matchGroup = opt.group?.toLowerCase().includes(query);
      return matchLabel || matchValue || matchSub || matchBadge || matchGroup;
    });
  }, [allOptions, searchTerm]);

  // Trigger change handler with smart synthetic event
  const triggerChange = useCallback(
    (newVal: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newVal);
      }

      if (onValueChange) {
        onValueChange(newVal);
      }

      if (onChange) {
        const syntheticEvent = {
          target: { value: newVal, name: name || "", id: id || "" },
          currentTarget: { value: newVal, name: name || "", id: id || "" },
          value: newVal,
          preventDefault: () => {},
          stopPropagation: () => {},
          persist: () => {},
        };
        (onChange as any)(syntheticEvent);
      }
    },
    [controlledValue, onChange, onValueChange, name, id]
  );

  // Toggle dropdown
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      setSearchTerm("");
      setHighlightedIndex(-1);
    } else {
      setIsOpen(false);
    }
  };

  // Select an option
  const handleSelectOption = (opt: SearchableOption) => {
    if (opt.disabled) return;
    triggerChange(opt.value);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Clear value
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerChange("");
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < filteredOptions.length
      ) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length === 1) {
        handleSelectOption(filteredOptions[0]);
      }
    }
  };

  // Group filtered options if any option has a group
  const groupedOptions = useMemo(() => {
    const hasGroups = filteredOptions.some((o) => Boolean(o.group));
    if (!hasGroups) return null;

    const groups: Record<string, SearchableOption[]> = {};
    for (const opt of filteredOptions) {
      const g = opt.group || "General";
      if (!groups[g]) groups[g] = [];
      groups[g].push(opt);
    }
    return groups;
  }, [filteredOptions]);

  // Display text on the closed button
  const displayText = useMemo(() => {
    if (selectedOption) {
      return selectedOption.label;
    }
    if (currentValue && currentValue !== "") {
      return currentValue;
    }
    return placeholder;
  }, [selectedOption, currentValue, placeholder]);

  const isSelectedActive = currentValue !== "" && currentValue !== undefined;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Underlying Hidden Native Select for standard form serialization & automated tests */}
      <select
        name={name}
        id={id}
        value={currentValue}
        onChange={(e) => triggerChange(e.target.value)}
        disabled={disabled}
        required={required}
        data-testid={dataTestId}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute h-0 w-0 opacity-0 overflow-hidden"
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {allOptions.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl transition-all shadow-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? "ring-2 ring-emerald-500/20 border-emerald-500" : ""
        } ${buttonClassName}`}
      >
        <span
          className={`truncate block font-medium ${
            isSelectedActive ? "text-slate-800" : "text-slate-400"
          }`}
        >
          {displayText}
        </span>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {allowClear && isSelectedActive && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              title="Clear selection"
              className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute z-50 mt-1.5 w-full min-w-[220px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          } ${dropdownClassName}`}
        >
          {/* Search & Filter Header Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-2.5 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Live Filter Indicator */}
            {showCount && (
              <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-500 font-semibold">
                <span className="flex items-center gap-1">
                  <Filter size={10} className="text-emerald-600" />
                  {searchTerm.trim() ? "Filtered matches:" : "Available options:"}
                </span>
                <span className="bg-slate-200/60 px-1.5 py-0.5 rounded-md text-slate-700">
                  {filteredOptions.length} of {allOptions.length}
                </span>
              </div>
            )}
          </div>

          {/* Options Scroll Container */}
          <div
            ref={optionsListRef}
            className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {allOptions.length === 0
                    ? "No options available"
                    : `No matches for "${searchTerm}"`}
                </p>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="mt-2 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : groupedOptions ? (
              // Grouped layout
              Object.entries(groupedOptions).map(([groupName, groupOpts]) => (
                <div key={groupName} className="py-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50 rounded-md mb-0.5">
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {groupOpts.map((opt) => {
                      const isSelected = opt.value === currentValue;
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          aria-selected={isSelected}
                          data-value={opt.value}
                          onClick={() => handleSelectOption(opt)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                            opt.disabled
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                              ? "bg-emerald-50 text-emerald-900 font-bold"
                              : "hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          {renderOption ? (
                            renderOption(opt, isSelected)
                          ) : (
                            <div className="truncate flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{opt.label}</span>
                                {opt.badge && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold shrink-0">
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              {opt.sublabel && (
                                <p className="text-[10px] text-slate-600 font-normal truncate mt-0.5">
                                  {opt.sublabel}
                                </p>
                              )}
                            </div>
                          )}
                          {isSelected && (
                            <Check size={14} className="text-emerald-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              // Flat layout
              <div className="space-y-0.5">
                {filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === currentValue;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      data-value={opt.value}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                          ? "bg-emerald-50 text-emerald-900 font-bold"
                          : isHighlighted
                          ? "bg-slate-100 text-slate-900"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {renderOption ? (
                        renderOption(opt, isSelected)
                      ) : (
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{opt.label}</span>
                            {opt.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold shrink-0">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.sublabel && (
                            <p className="text-[10px] text-slate-600 font-normal truncate mt-0.5">
                              {opt.sublabel}
                            </p>
                          )}
                        </div>
                      )}
                      {isSelected && (
                        <Check size={14} className="text-emerald-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default SearchableSelect;
