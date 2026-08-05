"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PackageDescription } from "@/utils/formTypes";
import { searchPackageDescriptions } from "@/lib/api/packageDescriptions";
import { ChevronDown, AlertCircle } from "lucide-react";

interface PackageDescriptionSelectorProps {
  value?: PackageDescription | null;
  onChange: (description: PackageDescription | null) => void;
  placeholder?: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  required?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
}

export default function PackageDescriptionSelector({
  value,
  onChange,
  placeholder = "Select package description...",
  onError,
  onSuccess,
  required = false,
  disabled = false,
  searchPlaceholder = "Search package description...",
}: PackageDescriptionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDescriptions, setFilteredDescriptions] = useState<PackageDescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch descriptions
  const fetchDescriptionsList = useCallback(async (searchQuery: string = "") => {
    try {
      setLoading(true);
      setError("");
      const results = await searchPackageDescriptions(searchQuery, 50);
      setFilteredDescriptions(results);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load package descriptions";
      setError(message);
      onError?.(message);
      setFilteredDescriptions([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (searchTerm.trim() || hasSearched) {
        fetchDescriptionsList(searchTerm);
      }
    }, 500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm, hasSearched, fetchDescriptionsList]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (description: PackageDescription) => {
    onChange(description);
    setIsOpen(false);
    setSearchTerm("");
    setError("");
    onSuccess?.(`Selected: ${description.packageDescription}`);
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e instanceof MouseEvent || (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' '))) {
      const event = e as unknown as React.MouseEvent;
      event.stopPropagation();
    }
    onChange(null);
    setSearchTerm("");
    setError("");
  };

  const displayValue = value ? value.packageDescription : "";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] focus:border-transparent transition-all flex items-center justify-between ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-gray-400"
        } ${required && !value ? "border-gray-300" : ""}`}
      >
        <span
          className={`text-left truncate ${
            value ? "text-gray-900 font-medium" : "text-gray-500"
          }`}
        >
          {displayValue || placeholder}
        </span>

        <div className="flex items-center gap-2 ml-2 shrink-0">
          {value && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                handleClear(e);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e);
                }
              }}
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1"
              title="Clear selection"
            >
              ✕
            </div>
          )}
          <ChevronDown
            size={20}
            className={`text-gray-600 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] text-sm"
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {/* Loading */}
            {loading && (
              <div className="p-4 text-center text-gray-600">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                <p className="mt-2 text-sm">Loading descriptions...</p>
              </div>
            )}


            {/* Empty state */}
            {!loading && filteredDescriptions.length === 0 && !error && hasSearched && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No package descriptions found
              </div>
            )}

            {/* Results */}
            {!loading && filteredDescriptions.length > 0 && (
              <ul className="divide-y divide-gray-200">
                {filteredDescriptions.map((description) => (
                  <li key={description.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(description)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium text-gray-900">{description.packageDescription}</span>
                      {value?.id === description.id && (
                        <span className="text-blue-500 text-sm font-bold">✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
