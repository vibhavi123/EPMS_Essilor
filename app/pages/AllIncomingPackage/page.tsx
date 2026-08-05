"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import Pagination, { usePagination } from "@/components/Pagination";
import { Search, Eye } from "lucide-react";
import { PermissionGuard } from "@/hooks/usePermissions";

interface IncomingPackage {
  id: number;
  trackingNumber: string;
  referenceNumber: string | null;
  mode: "single" | "batch";
  customerName: string;
  deliveryPersonName?: string | null;
  status: string;
  date: string;
  time: string;
  batchCount?: number;
  holdingState: number;
  guardVerificationStatus: string;
}

export default function AllIncomingPackagePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [packages, setPackages] = useState<IncomingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { goToIncomingVerification } = useNavigation();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/packages/incoming/list", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch packages");
        }

        setPackages(data.data || []);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        console.error("Error fetching packages:", errorMessage);
        setTimeout(() => {
          router.push(`/pages/error/incoming-package-error?error=${encodeURIComponent(errorMessage)}`);
        }, 500);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [router]);

  const normalizedPackages = useMemo(() => {
    const packageMap = new Map<string, IncomingPackage>();

    for (const pkg of packages) {
      const isBatch = pkg.mode?.toString().toLowerCase() === "batch";
      const key =
        isBatch && pkg.referenceNumber
          ? `batch-${pkg.referenceNumber}`
          : `single-${pkg.trackingNumber}`;

      if (!packageMap.has(key)) {
        packageMap.set(key, pkg);
      }
    }

    return Array.from(packageMap.values());
  }, [packages]);

  const filteredPackages = normalizedPackages
    .filter((pkg) => {
      const matchesSearch =
        pkg.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.referenceNumber && pkg.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pkg.customerName && pkg.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    })
    .sort((a, b) => {
      // Define status priority: "verified" first, then "completed", then others
      const getStatusPriority = (status: string) => {
        if (status === "verified") return 0;
        if (status === "Completed") return 1;
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

  const { currentPage, setCurrentPage, paginatedItems: paginatedPackages, totalPages, totalItems: totalIncomingPackages } = usePagination({ items: filteredPackages, itemsPerPage: 10 });

  // Handle error redirect
  useEffect(() => {
    if (error) {
      console.log("[AllIncomingPackage] Error detected:", error);
      const redirectUrl = `/pages/error/incoming-package-error?error=${encodeURIComponent(error)}`;
      console.log("[AllIncomingPackage] Redirecting to:", redirectUrl);
      router.push(redirectUrl);
    }
  }, [error, router]);

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
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0084c8]"></div>
            <p className="mt-4 text-gray-600">Loading error page...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PermissionGuard permission="incomeVerification">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        
          {/* --- HEADER SECTION --- */}
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">Incoming packages </h1>
          
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search by tracking or customer"
                className="w-full pl-4 pr-10 py-2 bg-white border border-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
        </header>

        <hr className="border-gray-200 mb-8" />

        {paginatedPackages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No packages found</p>
          </div>
        ) : null}

        {/* --- DESKTOP TABLE HEADERS --- */}
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

        {/* --- PACKAGE LIST --- */}
        <div className="space-y-4">
          {paginatedPackages.map((pkg) => (
            <div 
              key={pkg.mode?.toString().toLowerCase() === "batch" ? `batch-${pkg.referenceNumber}` : `single-${pkg.trackingNumber}`} 
              className="bg-white border border-[#6366f1]/30 rounded-2xl shadow-sm hover:border-[#6366f1] transition-all cursor-pointer"
            >
              {/* Desktop View Row */}
              <div 
                onClick={() => pkg.mode?.toString().toLowerCase() === "batch" ? goToIncomingVerification(undefined, pkg.referenceNumber || undefined, "batch") : goToIncomingVerification(pkg.trackingNumber)}
                className="hidden lg:grid grid-cols-12 gap-2 items-center px-8 py-5 text-[#2d3748] font-semibold text-sm xl:text-base"
              >
                <div className="col-span-1">
                  {pkg.mode?.toString().toLowerCase() === "batch" ? pkg.referenceNumber : pkg.trackingNumber}
                </div>
                
                <div className="col-span-2 flex justify-center">
                  <span className="px-5 py-1.5 rounded-xl bg-[#e2f9ec] text-[#34d399] text-xs font-black uppercase tracking-wider">
                    Incoming
                  </span>
                </div>

                <div className="col-span-1 text-center">
                  {pkg.mode?.toString().toLowerCase() === "batch" ? (
                    <span className="font-bold text-blue-600">{pkg.batchCount ?? 1}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

                <div className="col-span-2 text-center truncate px-2">{pkg.customerName || "N/A"}</div>
                <div className="col-span-1 flex justify-center">
                  <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                    pkg.mode?.toString().toLowerCase() === "single" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {pkg.mode?.toString().toLowerCase() === "single" ? "Single" : "Batch"}
                  </span>
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
                <div className="col-span-2 text-center whitespace-nowrap">{pkg.date}</div>
                <div className="col-span-1 text-center whitespace-nowrap">{pkg.time}</div>
                
                <div className="col-span-1 flex justify-end">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pkg.status !== "completed" && pkg.status?.toLowerCase() !== "collected" && pkg.status !== "Completed") {
                        void (pkg.mode?.toString().toLowerCase() === "batch" ? goToIncomingVerification(undefined, pkg.referenceNumber || undefined, "batch") : goToIncomingVerification(pkg.trackingNumber));
                      }
                    }}
                    disabled={pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed"}
                    className={`px-6 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all ${
                      pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed"
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed opacity-50"
                        : "bg-[#0084c8] hover:bg-[#0071ad] text-white active:scale-95"
                    }`}
                  >
                    {pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed" ? "Verified" : "View"}
                  </button>
                </div>
              </div>

              {/* Mobile View Card */}
              <div 
                onClick={() => pkg.mode?.toString().toLowerCase() === "batch" ? goToIncomingVerification(undefined, pkg.referenceNumber || undefined, "batch") : goToIncomingVerification(pkg.trackingNumber)}
                className="lg:hidden p-5 space-y-4 cursor-pointer"
              >
                <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                  <span className="font-black text-[#0c244c] tracking-tighter">
                    #{pkg.mode?.toString().toLowerCase() === "batch" ? pkg.referenceNumber : pkg.trackingNumber}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-[#e2f9ec] text-[#34d399] text-[10px] font-black uppercase tracking-widest">
                    Incoming
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="text-gray-400 font-medium">Customer:</div>
                  <div className="text-right font-bold truncate">{pkg.customerName || "N/A"}</div>
                  
                  <div className="text-gray-400 font-medium">Mode:</div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold inline-block ${
                      pkg.mode?.toString().toLowerCase() === "single" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {pkg.mode?.toString().toLowerCase() === "single" ? "Single" : "Batch"}
                    </span>
                  </div>

                  {pkg.mode?.toString().toLowerCase() === "batch" && (
                    <>
                      <div className="text-gray-400 font-medium">Count:</div>
                      <div className="text-right font-bold text-blue-600">{pkg.batchCount ?? 1}</div>
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

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pkg.status !== "completed" && pkg.status?.toLowerCase() !== "collected" && pkg.status !== "Completed") {
                      void (pkg.mode?.toString().toLowerCase() === "batch" ? goToIncomingVerification(undefined, pkg.referenceNumber || undefined, "batch") : goToIncomingVerification(pkg.trackingNumber));
                    }
                  }}
                  disabled={pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed"}
                  className={`w-full mt-2 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed"
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-[#0084c8] text-white hover:bg-[#0071ad]"
                  }`}
                >
                  <Eye size={18} /> {pkg.status === "completed" || pkg.status?.toLowerCase() === "collected" || pkg.status === "Completed" ? "Already Verified" : "View Package"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalIncomingPackages}
          itemsShown={paginatedPackages.length}
          onPageChange={setCurrentPage}
        />

        </main>
      </div>
    </PermissionGuard>
  );
}