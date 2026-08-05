"use client";

import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import FilterPanel from "@/components/FilterPanel";
import ReportModal from "@/components/ReportModal";
import Pagination, { usePagination } from "@/components/Pagination";
import { Search } from "lucide-react";
import { generateReportCSV } from "@/utils/reportGenerator";
import { ReportPackage } from "@/utils/formTypes";
import { PermissionGuard } from "@/hooks/usePermissions";

// API Package type
interface APIPackage {
  id?: string;
  trackingNumber: string;
  trackingNumbers?: string[];
  referenceNumber?: string;
  type: "Incoming" | "Outgoing";
  mode: "single" | "batch";
  customerName?: string;
  employeeName?: string;
  employeeId?: string;
  department?: string;
  employeeCompany?: string;
  deliveryCompany?: string;
  deliveryPersonName?: string;
  packageDescription?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  remark?: string;
  status?: string;
  verificationStatus?: string;
  date: string;
  time: string;
  createdAt?: string;
  updatedAt?: string;
  guardId?: string;
  employeeVerifiedId?: string;
  handOverGuardId?: string;
  guardVerificationStatus?: string;
}

export default function ReportPage() {
  const [packages, setPackages] = useState<ReportPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  const normalizeText = (value: string) => value.toLowerCase().trim();

  const getDateParts = (dateValue: string) => {
    const parts = dateValue.split(/[./-]/).map((part) => part.trim());

    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      const first = Number(parts[0]);
      const second = Number(parts[1]);
      const year = parts[2];

      // Support both MM/DD/YYYY and DD/MM/YYYY formats.
      const monthFirst = first >= 1 && first <= 12;
      const dayFirst = first > 12 && second >= 1 && second <= 12;

      const month = String(monthFirst ? first : second);
      const day = String(monthFirst ? second : first);

      if (monthFirst || dayFirst) {
        return { day, month, year };
      }

      return { day, month, year };
    }

    const parsedDate = new Date(dateValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        day: String(parsedDate.getDate()),
        month: String(parsedDate.getMonth() + 1),
        year: String(parsedDate.getFullYear()),
      };
    }

    return { day: "", month: "", year: "" };
  };

  // Fetch packages from backend API
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/packages/report");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch packages");
        }

        // Transform API data to match ReportPackage format.
        const transformedPackages = data.data.map((pkg: APIPackage) => ({
          id: pkg.id || pkg.trackingNumber,
          type: pkg.type,
          mode: pkg.mode,
          trackingNumber: pkg.trackingNumber,
          trackingNumbers:
            pkg.mode === "batch" && pkg.trackingNumbers?.length
              ? Array.from(new Set(pkg.trackingNumbers))
              : undefined,
          referenceNumber: pkg.mode === "batch" ? (pkg.referenceNumber || "") : undefined,
          status: pkg.status || pkg.verificationStatus || "N/A",
          customer: pkg.customerName || pkg.deliveryCompany || "N/A",
          employee: pkg.employeeName || pkg.deliveryPersonName || "N/A",
          employeeId: pkg.employeeId || "N/A",
          department: pkg.department || "N/A",
          employeeCompany: pkg.employeeCompany || "N/A",
          deliveryCompany: pkg.deliveryCompany || "N/A",
          deliveryPersonName: pkg.deliveryPersonName || "N/A",
          packageDescription: pkg.packageDescription || "N/A",
          remark: pkg.remark || "N/A",
          vehicleNumber: pkg.vehicleNumber || "N/A",
          vehicleType: pkg.vehicleType || "N/A",
          date: pkg.date,
          time: pkg.time,
          createdAt: pkg.createdAt || new Date().toISOString(),
          updatedAt: pkg.updatedAt || new Date().toISOString(),
          guardId: pkg.guardId || "N/A",
          employeeVerifiedId: pkg.employeeVerifiedId || "N/A",
          handOverGuardId: pkg.handOverGuardId || "N/A",
        }));

        setPackages(transformedPackages);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        console.error("Error fetching packages:", errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  // Apply filters
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const { month, year } = getDateParts(pkg.date);
      const searchTerm = normalizeText(searchQuery);
      const matchesSearch =
        normalizeText(pkg.id).includes(searchTerm) ||
        normalizeText(pkg.customer).includes(searchTerm) ||
        normalizeText(pkg.employee).includes(searchTerm) ||
        normalizeText(pkg.deliveryCompany).includes(searchTerm) ||
        normalizeText(pkg.deliveryPersonName || "").includes(searchTerm) ||
        normalizeText(pkg.packageDescription || "").includes(searchTerm) ||
        normalizeText(pkg.remark || "").includes(searchTerm) ||
        (pkg.trackingNumbers?.some((trackingNumber) => normalizeText(trackingNumber).includes(searchTerm)) ?? false);
      const matchesType = filterType === "" || pkg.type === filterType;
      const matchesMode = filterMode === "" || pkg.mode === filterMode;
      const matchesCustomer = filterCustomer === "" || normalizeText(pkg.customer).includes(normalizeText(filterCustomer));
      const matchesMonth = filterMonth === "" || month === filterMonth;
      const matchesYear = filterYear === "" || year === filterYear;
      
      return matchesSearch && matchesType && matchesMode && matchesCustomer && matchesMonth && matchesYear;
    });
  }, [searchQuery, filterType, filterMode, filterCustomer, filterMonth, filterYear, packages]);

  // Pagination for filtered data
  const { currentPage, setCurrentPage, paginatedItems: paginatedPackages, totalPages, totalItems: totalFilteredPackages } = usePagination({ items: filteredPackages, itemsPerPage: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterMode, filterCustomer, filterMonth, filterYear, setCurrentPage]);

  // All 12 months
  const allMonths = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const currentYear = 2026;
  const allYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  const uniqueTypes = [...new Set(packages.map((pkg) => pkg.type))];
  const uniqueModes = [...new Set(packages.map((pkg) => pkg.mode))];

  const getRowKey = (pkg: ReportPackage) => {
    const baseIdentifier = pkg.mode === "batch"
      ? (pkg.referenceNumber || pkg.trackingNumber)
      : pkg.trackingNumber;
    return `${pkg.type}-${pkg.mode}-${baseIdentifier}-${pkg.id}-${pkg.createdAt}`;
  };

  return (
    <PermissionGuard permission="reportAccess">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c] mb-6">Reports</h1>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#0084c8] border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Loading report data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">Error loading reports: {error}</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <>
            {/* Search Bar */}
            <div className="mb-6 max-w-sm">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Track Number or Customer"
                  className="w-full pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            {/* Filters Section */}
            <FilterPanel
              filterType={filterType}
              filterMode={filterMode}
              filterCustomer={filterCustomer}
              filterMonth={filterMonth}
              filterYear={filterYear}
              onFilterTypeChange={(value) => { setFilterType(value); setCurrentPage(1); }}
              onFilterModeChange={(value) => { setFilterMode(value); setCurrentPage(1); }}
              onFilterCustomerChange={(value) => { setFilterCustomer(value); setCurrentPage(1); }}
              onFilterMonthChange={(value) => { setFilterMonth(value); setCurrentPage(1); }}
              onFilterYearChange={(value) => { setFilterYear(value); setCurrentPage(1); }}
              onReset={() => {
                setFilterType("");
                setFilterMode("");
                setFilterCustomer("");
                setFilterMonth("");
                setFilterYear("");
                setCurrentPage(1);
              }}
              onGenerateReport={() => setShowReportModal(true)}
              uniqueTypes={uniqueTypes}
              uniqueModes={uniqueModes}
              allMonths={allMonths}
              allYears={allYears}
            />

            {/* Results Info */}
            <div className="mb-4 text-gray-600">
              <p className="text-sm">Showing <span className="font-bold text-[#0084c8]">{filteredPackages.length}</span> filtered results</p>
            </div>

            {filteredPackages.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center border border-gray-100">
                <p className="text-gray-500 text-lg">No packages match your filters</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Track #</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Mode</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Customer</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Delivery Co.</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Employee</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Dept.</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-[#f87171] uppercase tracking-widest">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedPackages.map((pkg) => (
                      <tr key={getRowKey(pkg)} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-[#0084c8]">{pkg.id}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                            pkg.type === "Incoming" ? "bg-[#e2f9ec] text-[#34d399]" : "bg-[#fff1f2] text-[#fb7185]"
                          }`}>
                            {pkg.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                            pkg.mode === "single" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {pkg.mode === "single" ? "Single" : "Batch"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{pkg.customer}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{pkg.deliveryCompany}</td>
                        <td className="px-6 py-4 text-sm">{pkg.employee}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{pkg.department}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                            pkg.status === "Completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                            pkg.status === "Pending" ? "bg-orange-100 text-orange-600" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {pkg.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {pkg.date} <br/> <span className="text-xs text-gray-400">{pkg.time}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-3">
              {paginatedPackages.map((pkg) => (
                <div key={getRowKey(pkg)} className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div><p className="text-xs text-gray-500">Track #</p><p className="font-bold text-[#0084c8]">{pkg.id}</p></div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        pkg.type === "Incoming" ? "bg-[#e2f9ec] text-[#34d399]" : "bg-[#fff1f2] text-[#fb7185]"
                      }`}>{pkg.type}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        pkg.mode === "single" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>{pkg.mode === "single" ? "Single" : "Batch"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div><p className="text-gray-500">Customer</p><p className="font-bold">{pkg.customer}</p></div>
                    <div><p className="text-gray-500">Delivery Co.</p><p className="font-bold">{pkg.deliveryCompany}</p></div>
                    <div><p className="text-gray-500">Employee</p><p className="font-bold">{pkg.employee}</p></div>
                    <div><p className="text-gray-500">Dept.</p><p className="font-bold">{pkg.department}</p></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                      pkg.status === "Completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                      pkg.status === "Pending" ? "bg-orange-100 text-orange-600" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {pkg.status}
                    </span>
                    <span className="text-xs font-medium text-gray-500">{pkg.date} • {pkg.time}</span>
                  </div>
                </div>
              ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalFilteredPackages}
                  itemsShown={paginatedPackages.length}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        filteredPackages={filteredPackages}
        onClose={() => setShowReportModal(false)}
        onDownload={() => generateReportCSV(filteredPackages)}
      />
      </div>
    </PermissionGuard>
  );
}