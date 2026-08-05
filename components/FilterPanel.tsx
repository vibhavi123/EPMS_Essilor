import React from "react";
import { Search } from "lucide-react";

interface FilterPanelProps {
  filterType: string;
  filterMode: string;
  filterCustomer: string;
  filterMonth: string;
  filterYear: string;
  onFilterTypeChange: (value: string) => void;
  onFilterModeChange: (value: string) => void;
  onFilterCustomerChange: (value: string) => void;
  onFilterMonthChange: (value: string) => void;
  onFilterYearChange: (value: string) => void;
  onReset: () => void;
  onGenerateReport: () => void;
  uniqueTypes: string[];
  uniqueModes: string[];
  allMonths: { value: string; label: string }[];
  allYears: number[];
}

export default function FilterPanel({
  filterType,
  filterMode,
  filterCustomer,
  filterMonth,
  filterYear,
  onFilterTypeChange,
  onFilterModeChange,
  onFilterCustomerChange,
  onFilterMonthChange,
  onFilterYearChange,
  onReset,
  onGenerateReport,
  uniqueTypes,
  uniqueModes,
  allMonths,
  allYears,
}: FilterPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-gray-100">
      <h3 className="text-lg font-bold text-[#0c244c] mb-4">Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Type Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="">All Types</option>
            {uniqueTypes.map((type: string) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Mode Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Mode</label>
          <select
            value={filterMode}
            onChange={(e) => onFilterModeChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="">All Modes</option>
            {uniqueModes.map((mode: string) => (
              <option key={mode} value={mode}>{mode === "single" ? "Single" : "Batch"}</option>
            ))}
          </select>
        </div>

        {/* Customer Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Customer</label>
          <div className="relative">
            <input
              type="text"
              value={filterCustomer}
              onChange={(e) => onFilterCustomerChange(e.target.value)}
              placeholder="Search customer"
              className="w-full pl-3 pr-10 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
        </div>

        {/* Month Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
          <select
            value={filterMonth}
            onChange={(e) => onFilterMonthChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="">All Months</option>
            {allMonths.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
          <select
            value={filterYear}
            onChange={(e) => onFilterYearChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="">All Years</option>
            {allYears.map((year) => (
              <option key={year} value={year.toString()}>{year}</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-end gap-2">
          <button
            onClick={onReset}
            className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-semibold text-sm transition-all active:scale-95"
          >
            Reset
          </button>
          
          <button
            onClick={onGenerateReport}
            className="flex-1 px-4 py-2 bg-[#0084c8] hover:bg-[#0071ad] text-white rounded-lg font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
