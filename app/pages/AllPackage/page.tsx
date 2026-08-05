"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import Pagination, { usePagination } from "@/components/Pagination";
import { Search, ChevronDown, X } from "lucide-react";
import { PermissionGuard } from "@/hooks/usePermissions";

interface Package {
  id: string;
  type: "Incoming" | "Outgoing";
  mode: "single" | "batch";
  referenceNumber: string | null;
  customerName?: string;
  deliveryPersonName?: string;
  packageDescription?: string;
  status: string;
  date: string;
  time: string;
  trackingNumber: string;
  trackingNumbers?: string[]; 
  batchCount?: number; 
  holdingState: number;
  guardVerificationStatus: string;
}

export default function AllPackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"" | "Incoming" | "Outgoing">("");
  const [filterMode, setFilterMode] = useState<"" | "single" | "batch">("");
  const [filterDate, setFilterDate] = useState("");
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { goToIncomingPackageDetails, goToOutgoingPackageDetails } = useNavigation();

  const convertToYYYYMMDD = (dateStr: string): string => {
    if (!dateStr) return "";
    dateStr = dateStr.trim().split(/[T |]/)[0]; // Remove time portion if present
    
    // If already in YYYY-MM-DD format (from date input)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // If in MM/DD/YYYY format (slashes)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const parts = dateStr.split("/");
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    // If in M.D.YYYY format (dots - European style)
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(".");
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    // If in MM-DD-YYYY format (dashes)
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
      const parts = dateStr.split("-");
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  };

  const isPackageVerified = (pkg: Package): boolean => {
    const guardStatus = (pkg.guardVerificationStatus || "").trim().toLowerCase();
    const packageStatus = (pkg.status || "").trim().toLowerCase();

    return (
      guardStatus === "verified" ||
      packageStatus === "verified" ||
      packageStatus === "completed" ||
      packageStatus === "collected"
    );
  };

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/packages/all");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch packages");
        }

        setPackages(data.data || []);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        console.error("Error fetching packages:", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const filteredPackages = packages
    .filter((pkg) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      pkg.trackingNumber.toLowerCase().includes(searchLower) ||
      (pkg.trackingNumbers?.some((trackingNumber) => trackingNumber.toLowerCase().includes(searchLower)) ?? false) ||
      (pkg.customerName && pkg.customerName.toLowerCase().includes(searchLower)) ||
      (pkg.deliveryPersonName && pkg.deliveryPersonName.toLowerCase().includes(searchLower)) ||
      (pkg.referenceNumber && pkg.referenceNumber.toLowerCase().includes(searchLower));
    
    const matchesType = filterType === "" || pkg.type === filterType;
    const matchesMode = filterMode === "" || pkg.mode === filterMode;
    
    let matchesDate = true;
    if (filterDate) {
      const packageDateNormalized = convertToYYYYMMDD(pkg.date);
      matchesDate = packageDateNormalized === filterDate;
    }
    
    return matchesSearch && matchesType && matchesMode && matchesDate;
    })
    .sort((a, b) => {
      // Verified packages first
      const aVerified = isPackageVerified(a) ? 1 : 0;
      const bVerified = isPackageVerified(b) ? 1 : 0;
      
      if (aVerified !== bVerified) {
        return bVerified - aVerified; // Verified first
      }
      
      // If same verification status, maintain original order
      return 0;
    });

  const { currentPage, setCurrentPage, paginatedItems: paginatedPackages, totalPages, totalItems: totalPackages } = usePagination({ items: filteredPackages, itemsPerPage: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterMode, filterDate, setCurrentPage]);

  const getRowKey = (pkg: Package) => 
    `${pkg.type}-${pkg.mode}-${pkg.referenceNumber || pkg.trackingNumber}-${pkg.id}`;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0084c8]"></div>
            <p className="mt-4 text-gray-600">Loading packages...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 font-bold">Error: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 bg-[#0084c8] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0071ad]"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PermissionGuard permission="allPackagesView">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        
        {/* --- HEADER SECTION --- */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">All packages ({totalPackages})</h1>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search by tracking or name"
                className="w-full pl-4 pr-10 py-2 bg-white border border-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
        </header>

        {/* --- FILTER SECTION --- */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4">
            <h3 className="text-lg font-bold text-[#2d3748]">Filters</h3>
            {(filterType || filterMode || filterDate) && (
              <button
                onClick={() => {
                  setFilterType("");
                  setFilterMode("");
                  setFilterDate("");
                  setCurrentPage(1);
                }}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                <X size={16} /> Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-semibold text-[#2d3748] mb-2">Package Type</label>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as "" | "Incoming" | "Outgoing");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer font-medium"
                >
                  <option value="">All Types</option>
                  <option value="Incoming">Incoming</option>
                  <option value="Outgoing">Outgoing</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Mode Filter */}
            <div>
              <label className="block text-sm font-semibold text-[#2d3748] mb-2">Package Mode</label>
              <div className="relative">
                <select
                  value={filterMode}
                  onChange={(e) => {
                    setFilterMode(e.target.value as "" | "single" | "batch");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer font-medium"
                >
                  <option value="">All Modes</option>
                  <option value="single">Single</option>
                  <option value="batch">Batch</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-semibold text-[#2d3748] mb-2">Filter by Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- ACTIVE FILTERS DISPLAY --- */}
        {(filterType || filterMode || filterDate) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {filterType && (
              <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold text-sm">
                Type: {filterType}
                <button onClick={() => { setFilterType(""); setCurrentPage(1); }} className="hover:text-blue-900">
                  <X size={16} />
                </button>
              </span>
            )}
            {filterMode && (
              <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold text-sm">
                Mode: {filterMode === "single" ? "Single" : "Batch"}
                <button onClick={() => { setFilterMode(""); setCurrentPage(1); }} className="hover:text-green-900">
                  <X size={16} />
                </button>
              </span>
            )}
            {filterDate && (
              <span className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-semibold text-sm">
                Date: {filterDate}
                <button onClick={() => { setFilterDate(""); setCurrentPage(1); }} className="hover:text-orange-900">
                  <X size={16} />
                </button>
              </span>
            )}
          </div>
        )}

        {paginatedPackages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No packages found</p>
          </div>
        ) : null}

        {/* --- DESKTOP TABLE HEADERS --- */}
            <div className="hidden lg:grid grid-cols-12 gap-0 px-8 mb-4 text-[#f87171] font-bold text-sm md:text-base uppercase tracking-wider">
              <div className="col-span-2">Reference / Track</div>
              <div className="col-span-1 text-center">Type</div>
              <div className="col-span-1 text-center">Mode</div>
              <div className="col-span-2 text-center">Customer</div>
              <div className="col-span-1 text-center">Count</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-3 text-center">Date & Time</div>
            </div>

            {/* --- PACKAGE LIST --- */}
            <div className="space-y-4">
              {paginatedPackages.map((pkg) => (
                <div 
                  key={getRowKey(pkg)}
                  className="bg-white border border-[#6366f1]/30 rounded-2xl shadow-sm hover:border-[#6366f1] transition-all cursor-pointer"
                >
                  {/* Desktop View Row */}
                  <div 
                    onClick={() => {
                      if (pkg.type === "Incoming") {
                        goToIncomingPackageDetails(pkg.trackingNumber);
                      } else {
                        goToOutgoingPackageDetails(pkg.trackingNumber);
                      }
                    }}
                    className="hidden lg:grid grid-cols-12 gap-0 items-center px-8 py-5 text-[#2d3748] font-semibold text-sm xl:text-base"
                  >
                    <div className="col-span-2">
                      {pkg.mode === "batch" ? pkg.referenceNumber || "N/A" : pkg.trackingNumber}
                    </div>
                    
                    <div className="col-span-1 flex justify-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                        pkg.type === "Incoming" ? "bg-[#e2f9ec] text-[#34d399]" : "bg-[#fef3c7] text-[#f59e0b]"
                      }`}>
                        {pkg.type}
                      </span>
                    </div>

                    <div className="col-span-1 flex justify-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                        pkg.mode === "single" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {pkg.mode === "single" ? "Single" : "Batch"}
                      </span>
                    </div>

                    <div className="col-span-2 text-center truncate px-2">
                      {pkg.customerName || "N/A"}
                    </div>
                    
                    <div className="col-span-1 text-center">
                      {pkg.mode === "batch" ? (
                        <span className="font-bold text-blue-600">{pkg.batchCount}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    
                    <div className="col-span-1 flex justify-center">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                        pkg.status === "Completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                        pkg.status === "Pending" ? "bg-orange-100 text-orange-600" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {pkg.status}
                      </span>
                    </div>
                    <div className="col-span-3 text-center whitespace-nowrap">{pkg.date} | {pkg.time}</div>
                
                  </div>

                  {/* Mobile View Card */}
                  <div 
                    onClick={() => {
                      if (pkg.type === "Incoming") {
                        goToIncomingPackageDetails(pkg.trackingNumber);
                      } else {
                        goToOutgoingPackageDetails(pkg.trackingNumber);
                      }
                    }}
                    className="lg:hidden p-5 space-y-4 cursor-pointer"
                  >
                    <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                      <span className="font-black text-[#0c244c] tracking-tighter">
                        #{pkg.mode === "batch" ? pkg.referenceNumber || "N/A" : pkg.trackingNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        {pkg.mode === "batch" && (
                          <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold">
                            {pkg.batchCount} items
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          pkg.type === "Incoming" ? "bg-[#e2f9ec] text-[#34d399]" : "bg-[#fef3c7] text-[#f59e0b]"
                        }`}>
                          {pkg.type}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <div className="text-gray-400 font-medium">Customer:</div>
                      <div className="text-right font-bold truncate">
                        {pkg.customerName || "N/A"}
                      </div>
                      
                      <div className="text-gray-400 font-medium">Mode:</div>
                      <div className="text-right font-bold">{pkg.mode}</div>
                      
                      {pkg.mode === "batch" && (
                        <>
                          <div className="text-gray-400 font-medium">Items in Batch:</div>
                          <div className="text-right font-bold text-blue-600">{pkg.batchCount}</div>
                        </>
                      )}
                      
                      <div className="text-gray-400 font-medium">Status:</div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-md text-xs font-bold inline-block ${
                          pkg.status === "Completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                          pkg.status === "Pending" ? "bg-orange-100 text-orange-600" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {pkg.status}
                        </span>
                      </div>
                      <div className="text-gray-400 font-medium">Schedule:</div>
                      <div className="text-right font-bold text-gray-700">{pkg.date} | {pkg.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalPackages}
              itemsShown={paginatedPackages.length}
              onPageChange={setCurrentPage}
            />

      </main>
    </div>
    </PermissionGuard>
  );
}
