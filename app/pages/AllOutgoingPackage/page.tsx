"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import Pagination, { usePagination } from "@/components/Pagination";
import { fetchOutgoingPackages } from "@/lib/api/outgoingPackageList";
import { Search, Eye } from "lucide-react";
import { PermissionGuard } from "@/hooks/usePermissions";

interface DisplayPackage {
  id: number;
  trackingNumber: string;
  referenceNumber: string;
  type: string;
  customer: string;
  employee: string;
  status: string;
  date: string;
  time: string;
  mode: "single" | "batch";
  batchCount?: number;
}

export default function OutgoingPackagesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [packagesList, setPackagesList] = useState<DisplayPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { goToOutgoingVerification } = useNavigation();
  const { currentPage, setCurrentPage, paginatedItems: paginatedPackages, totalPages, totalItems: totalOutgoingPackages } = usePagination({ items: packagesList, itemsPerPage: 10 });

  // Handle error redirect
  useEffect(() => {
    if (error) {
      console.log("[AllOutgoingPackage] Error detected:", error);
      const redirectUrl = `/pages/error/outgoing-package-error?error=${encodeURIComponent(error)}`;
      console.log("[AllOutgoingPackage] Redirecting to:", redirectUrl);
      router.push(redirectUrl);
    }
  }, [error, router]);

  // Fetch packages on component mount and when search changes
  useEffect(() => {
    const loadPackages = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchOutgoingPackages({
          search: searchQuery || undefined,
        });

        if (!result.success || !result.data) {
          setError(result.error || "Failed to load packages");
          setPackagesList([]);
          return;
        }

        // Transform API data to match display format
        const transformedPackages = result.data.map((pkg) => ({
          id: pkg.id,
          trackingNumber: pkg.trackingNumber,
          referenceNumber: pkg.referenceNumber || `TRK-${pkg.trackingNumber}`,
          type: "Outgoing",
          customer: pkg.customerName || pkg.deliveryCompany || "N/A",
          employee: pkg.deliveryPersonName || "N/A",
          status: pkg.verificationStatus || "holding",
          date: pkg.date || "N/A",
          time: pkg.time || "N/A",
          mode: pkg.mode,
          batchCount: pkg.batchCount,
        })).sort((a, b) => {
          // Define status priority: "verified" first, then "completed", then others
          const getStatusPriority = (status: string) => {
            const normalizedStatus = status.toLowerCase();
            if (normalizedStatus === "verified") return 0;
            if (normalizedStatus === "completed") return 1;
            return 2;
          };

          const aPriority = getStatusPriority(a.status);
          const bPriority = getStatusPriority(b.status);

          // First sort by status priority
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          // Within same status, sort by date/time descending (latest first)
          try {
            const aDateTime = new Date(`${a.date} ${a.time}`).getTime();
            const bDateTime = new Date(`${b.date} ${b.time}`).getTime();
            return bDateTime - aDateTime; // descending order
          } catch {
            return 0;
          }
        });

        setPackagesList(transformedPackages);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching packages:", errorMessage);
        setTimeout(() => {
          router.push(`/pages/error/outgoing-package-error?error=${encodeURIComponent(errorMessage)}`);
        }, 500);
      } finally {
        setIsLoading(false);
      }
    };

    loadPackages();
  }, [searchQuery, router]);

  // LOADING STATE
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="mb-4 inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0084c8] border-t-transparent"></div>
              </div>
              <p className="text-gray-600">Loading packages...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    router.push(`/pages/error/outgoing-package-error?error=${encodeURIComponent(error)}`);
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0084c8]"></div>
            <p className="mt-4 text-gray-600">Loading error page...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PermissionGuard permission="outgoingVerification">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        
          {/* --- TOP HEADER --- */}
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">Outgoing packages</h1>
          
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-4 pr-10 py-2 bg-white border border-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
        </header>

        <hr className="border-gray-200 mb-8" />

        {/* --- TABLE HEADERS (Desktop) --- */}
        <div className="hidden lg:grid grid-cols-12 gap-2 px-8 mb-4 text-[#f87171] font-bold text-sm md:text-base uppercase tracking-wider">
          <div className="col-span-1">Reference Number</div>
          <div className="col-span-2 text-center">Type</div>
          <div className="col-span-1 text-center">Count</div>
          <div className="col-span-2 text-center">Customer</div>
          <div className="col-span-1 text-center">Mode</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-2 text-center">Date</div>
          <div className="col-span-1 text-center">Time</div>
          <div className="col-span-1 text-right pr-2">Action</div>
        </div>

        {/* --- PACKAGE CARDS --- */}
        {paginatedPackages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg">No packages found</p>
            {searchQuery && (
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your search query
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedPackages.map((pkg) => (
            <div 
              key={pkg.id} 
              className="bg-white border border-[#6366f1]/30 rounded-2xl shadow-sm hover:border-[#6366f1] transition-all cursor-pointer"
            >
              {/* Desktop View Row */}
              <div 
                onClick={() => pkg.mode === "batch" ? goToOutgoingVerification(undefined, pkg.referenceNumber, "batch") : goToOutgoingVerification(pkg.trackingNumber)}
                className="hidden lg:grid grid-cols-12 gap-2 items-center px-8 py-5 text-[#2d3748] font-semibold text-sm xl:text-base"
              >
                <div className="col-span-1">
                  {pkg.mode === "single" ? pkg.trackingNumber : pkg.referenceNumber}
                </div>
                
                {/* Outgoing Badge (Red) */}
                <div className="col-span-2 flex justify-center">
                  <span className="px-5 py-1.5 rounded-xl bg-[#fee2e2] text-[#ef4444] text-xs font-black uppercase tracking-wider">
                    {pkg.type}
                  </span>
                </div>

                <div className="col-span-1 text-center">
                  {pkg.mode === "batch" ? (
                    <span className="font-bold text-blue-600">{pkg.batchCount ?? 1}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

                <div className="col-span-2 text-center truncate px-2">{pkg.customer}</div>
                <div className="col-span-1 flex justify-center">
                  <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                    pkg.mode === "single" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {pkg.mode === "single" ? "Single" : "Batch"}
                  </span>
                </div>
                <div className="col-span-1 flex justify-center">
                  <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                    pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                    pkg.status?.toLowerCase() === "holding" ? "bg-orange-100 text-orange-600" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {pkg.status}
                  </span>
                </div>

                <div className="col-span-2 text-center whitespace-nowrap">{pkg.date}</div>
                <div className="col-span-1 text-center whitespace-nowrap">{pkg.time}</div>
                
                <div className="col-span-1 flex justify-end">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pkg.status?.toLowerCase() !== "completed" && pkg.status?.toLowerCase() !== "collected") {
                        void (pkg.mode === "batch" ? goToOutgoingVerification(undefined, pkg.referenceNumber, "batch") : goToOutgoingVerification(pkg.trackingNumber));
                      }
                    }}
                    disabled={pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected"}
                    className={`px-6 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all ${
                      pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected"
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed opacity-50"
                        : "bg-[#0084c8] hover:bg-[#0071ad] text-white active:scale-95"
                    }`}
                  >
                    {pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected" ? "Verified" : "View"}
                  </button>
                </div>
              </div>

              {/* Mobile View Card */}
              <div 
                onClick={() => pkg.mode === "batch" ? goToOutgoingVerification(undefined, pkg.referenceNumber, "batch") : goToOutgoingVerification(pkg.trackingNumber)}
                className="lg:hidden p-5 space-y-4 cursor-pointer"
              >
                <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                  <span className="font-black text-[#0c244c]">
                    #{pkg.mode === "single" ? pkg.trackingNumber : pkg.referenceNumber}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-[#fee2e2] text-[#ef4444] text-[10px] font-black uppercase">
                    {pkg.type}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="text-gray-400 font-medium">Customer:</div>
                  <div className="text-right font-bold truncate">{pkg.customer}</div>
                  
                  <div className="text-gray-400 font-medium">Mode:</div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold inline-block ${
                      pkg.mode === "single" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {pkg.mode === "single" ? "Single" : "Batch"}
                    </span>
                  </div>

                  {pkg.mode === "batch" && (
                    <>
                      <div className="text-gray-400 font-medium">Count:</div>
                      <div className="text-right font-bold text-blue-600">{pkg.batchCount ?? 1}</div>
                    </>
                  )}
                  
                  <div className="text-gray-400 font-medium">Status:</div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold inline-block ${
                      pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected" ? "bg-green-100 text-green-700" :
                      pkg.status?.toLowerCase() === "holding" ? "bg-orange-100 text-orange-600" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {pkg.status}
                    </span>
                  </div>
                  
                  <div className="text-gray-400 font-medium">Date/Time:</div>
                  <div className="text-right font-bold text-gray-500">{pkg.date} | {pkg.time}</div>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pkg.status?.toLowerCase() !== "completed" && pkg.status?.toLowerCase() !== "collected") {
                      void (pkg.mode === "batch" ? goToOutgoingVerification(undefined, pkg.referenceNumber, "batch") : goToOutgoingVerification(pkg.trackingNumber));
                    }
                  }}
                  disabled={pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected"}
                  className={`w-full mt-2 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected"
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-[#0084c8] text-white hover:bg-[#0071ad]"
                  }`}
                >
                  <Eye size={18} /> {pkg.status?.toLowerCase() === "completed" || pkg.status?.toLowerCase() === "collected" ? "Already Verified" : "View Details"}
                </button>
              </div>
            </div>
          ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalOutgoingPackages}
          itemsShown={paginatedPackages.length}
          onPageChange={setCurrentPage}
        />

        </main>
      </div>
    </PermissionGuard>
  );
}