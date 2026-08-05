"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, AlertCircle, X } from "lucide-react";
import { EmployeeData } from "@/utils/formTypes";

interface EmployeeSelectorProps {
  value?: EmployeeData | null;
  onChange: (employee: EmployeeData | null) => void;
  placeholder?: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  required?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  company?: string; 
  department?: string; 
}

export default function EmployeeSelector({
  value,
  onChange,
  placeholder = "Select an employee...",
  onError,
  onSuccess,
  required = false,
  disabled = false,
  searchPlaceholder = "Search by name or ID...",
  company,
  department,
}: EmployeeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch employees
  const fetchEmployees = useCallback(async (searchQuery: string = "") => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (company) {
        params.append("company", company);
      }
      if (department) {
        params.append("department", department);
      }
      params.append("limit", "50");

      const response = await fetch(`/api/employees?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch employees");
      }

      const employeeList = Array.isArray(data.data) ? data.data : [];
      setFilteredEmployees(employeeList);
      setHasSearched(true);

      if (employeeList.length === 0 && searchQuery.trim()) {
        setError("No employees found");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch employees";
      setError(errorMessage);
      onError?.(errorMessage);
      setFilteredEmployees([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, [company, department, onError]);

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (searchTerm.trim() || hasSearched) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchEmployees(searchTerm);
      }, 500);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm, hasSearched, fetchEmployees]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Initial load of employees when dropdown opens
  useEffect(() => {
    if (isOpen && filteredEmployees.length === 0 && !hasSearched) {
      fetchEmployees();
    }
  }, [isOpen, filteredEmployees.length, hasSearched, fetchEmployees]);

  const handleSelect = (employee: EmployeeData) => {
    onChange(employee);
    setIsOpen(false);
    setSearchTerm("");
    setError("");
    onSuccess?.(`Selected employee: ${employee.employeeName}`);
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (
      e instanceof MouseEvent ||
      (e instanceof KeyboardEvent && (e.key === "Enter" || e.key === " "))
    ) {
      const event = e as unknown as React.MouseEvent;
      event.stopPropagation();
    }
    onChange(null);
    setSearchTerm("");
    setError("");
    setHasSearched(false);
    setFilteredEmployees([]);
  };

  const displayValue = value ? value.employeeName : "";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main input button */}
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
                handleClear(e as unknown as React.MouseEvent);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClear(e);
                }
              }}
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1"
              title="Clear selection"
            >
              <X size={16} />
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
                <p className="mt-2 text-sm">Loading employees...</p>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="p-4 text-sm text-red-600 bg-red-50 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredEmployees.length === 0 && !error && hasSearched && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No employees found
              </div>
            )}

            {/* Results */}
            {!loading && filteredEmployees.length > 0 && (
              <ul className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <li key={employee.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(employee)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium text-gray-900">{employee.employeeName}</span>
                      {value?.id === employee.id && (
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
