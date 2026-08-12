"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import { useNavigation } from "@/hooks/useNavigation";
import { Pencil, Search, X } from "lucide-react";

// Helper function to format date only
function formatDate(dateTimeString: string | null): string {
  if (!dateTimeString) return "N/A";
  try {
    const date = new Date(dateTimeString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateTimeString;
  }
}

// Helper function to format time only
function formatTime(dateTimeString: string | null): string {
  if (!dateTimeString) return "N/A";
  try {
    const date = new Date(dateTimeString);
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateTimeString;
  }
}

interface PackageData {
  trackingNumber: string;
  referenceNumber: string | null;
  mode: string;
  customerName: string;
  employeeName: string | null;
  verificationStatus: string;
  employeeId: string | null;
  employeeCompany: string | null;
  department: string | null;
  deliveryCompany: string;
  deliveryPersonName: string;
  remark: string | null;
  vehicleNumber: string;
  vehicleType: string;
  date: string;
  time: string;
  createdAt: string | null;
  batchTrackingNumbers: string[];
  guardId: string | null;
  guardName: string | null;
  handOverGuardId: string | null;
  handOverGuardName: string | null;
  guardVerificationStatus: string;
  guardVerifiedAt: string | null;
}

function IncomingPackageDetailContent() {
  const searchParams = useSearchParams();
  const trackingNumber = searchParams.get("trackingNumber");
  const { goToIncomingPackageUpdate } = useNavigation();
  
  const [data, setData] = useState<PackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canViewGuardVerifiedId, setCanViewGuardVerifiedId] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        if (!mounted) return;

        const hasEditPermission = Boolean(response.ok && result?.success && result?.data?.permissions?.allPackagesEdit);
        const hasViewGuardVerifiedId = Boolean(response.ok && result?.success && result?.data?.permissions?.guardVerifiedIdView);
        setCanEdit(hasEditPermission);
        setCanViewGuardVerifiedId(hasViewGuardVerifiedId);
      } catch {
        if (mounted) {
          setCanEdit(false);
          setCanViewGuardVerifiedId(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!trackingNumber) {
      setError("Tracking number not provided");
      setLoading(false);
      return;
    }

    const fetchPackageDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/packages/incoming/details?trackingNumber=${trackingNumber}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load package details. Please check the tracking number and try again.");
        }

        if (!result.data) {
          throw new Error("The package details could not be retrieved. Please try again or contact support.");
        }

        setData(result.data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        console.error("Error fetching package details:", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageDetails();
  }, [trackingNumber]);

  const handleEdit = () => {
    goToIncomingPackageUpdate(data?.trackingNumber);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0084c8]"></div>
            <p className="mt-4 text-gray-600">Loading package details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 font-bold mb-4 text-lg">Unable to Load Package</p>
            <p className="text-gray-700 mb-6 max-w-md mx-auto">{error || "The package could not be found. Please verify the tracking number and try again."}</p>
            <button 
              onClick={() => window.history.back()}
              className="bg-[#0084c8] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0071ad]"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12">
        {/* Package View */}
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-[#0c244c]">Package Details</h1>
              <div className="hidden md:block">
                <DateTime />
              </div>
            </div>

            <div className="max-w-5xl mx-auto bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-[#0c244c] px-8 py-5 flex justify-between items-center">
                <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">{data.mode === "batch" ? "Reference Number" : "Tracking Number"}</span>
                <span className="text-2xl font-bold text-white tracking-tight">{data.mode === "batch" ? data.referenceNumber : data.trackingNumber}</span>
              </div>
              <div className="bg-[#8e99ac] px-10 py-3 hidden md:grid grid-cols-2 text-white font-bold text-lg">
                <span>Name</span>
                <span>Details</span>
              </div>

              <div className="p-8 md:p-14">
                <div className="space-y-6">
                  
                  {/* Batch Tracking Numbers Section */}
                  {data.mode === "batch" && data.batchTrackingNumbers.length > 0 && (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <h3 className="font-bold text-[#0c244c]">
                            Batch Tracking Numbers
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              {batchSearch
                                ? `${data.batchTrackingNumbers.filter((tn) => tn.toLowerCase().includes(batchSearch.toLowerCase())).length} of ${data.batchTrackingNumbers.length}`
                                : `${data.batchTrackingNumbers.length} total`}
                            </span>
                          </h3>
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <input
                              type="text"
                              value={batchSearch}
                              onChange={(e) => setBatchSearch(e.target.value)}
                              placeholder="Search tracking number…"
                              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            {batchSearch && (
                              <button
                                type="button"
                                onClick={() => setBatchSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const filtered = data.batchTrackingNumbers.filter((tn) =>
                            tn.toLowerCase().includes(batchSearch.toLowerCase())
                          );
                          return filtered.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No tracking numbers match &quot;{batchSearch}&quot;</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {filtered.map((tn, idx) => (
                                <div key={idx} className="bg-white border border-blue-100 rounded p-3">
                                  <p className="text-xs text-gray-500 mb-1">#{data.batchTrackingNumbers.indexOf(tn) + 1}</p>
                                  <p className="font-bold text-blue-600 font-mono text-sm">{tn}</p>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="border-t border-gray-100 my-4" />
                    </>
                  )}
                  
                  <DetailItem label="Package Type" value="Incoming" isBadge badgeColor="green" />
                  <DetailItem label="Package Mode" value={data.mode === "single" ? "Single" : "Batch"} isBadge badgeColor="blue" />
                  <DetailItem label="Customer" value={data.customerName} />
                  <DetailItem label="Employee Name" value={data.employeeName || "N/A"} />
                  <DetailItem label="Status" value={data.verificationStatus} isBadge badgeColor="yellow" />
                  
                  <div className="border-t border-gray-100 my-4" /> 

                  <DetailItem label="Department" value={data.department || "N/A"} />
                  <DetailItem label="Employee Company" value={data.employeeCompany || "N/A"} />
                  <DetailItem label="Delivery Company" value={data.deliveryCompany} />
                  <DetailItem label="Delivery Person" value={data.deliveryPersonName} />
                  <DetailItem label="Remark" value={data.remark || "N/A"} />
                  <DetailItem label="Vehicle Number" value={data.vehicleNumber} />
                  <DetailItem label="Vehicle Type" value={data.vehicleType} />
                  
                  <div className="border-t border-gray-100 my-4" /> 
                  
                  <DetailItem label="Date" value={data.date} />
                  <DetailItem label="Time" value={data.time} />
                  
                  {/* Guard Verification Section */}
                  {data.guardVerificationStatus === "verified" && (
                    <>
                      <div className="border-t border-gray-100 my-4" />
                      <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                        <h3 className="font-bold text-[#0c244c] mb-4 flex items-center gap-2">
                          Guard Verification
                        </h3>
                        <div className="space-y-3">
                          <DetailItem label="Receive Guard Name" value={data.guardName || data.guardId || "N/A"} />
                          {canViewGuardVerifiedId && (
                            <DetailItem label="Receive Guard ID" value={data.guardId || "N/A"} />
                          )}
                          <DetailItem label="Hand Over Guard Name" value={data.handOverGuardName || data.handOverGuardId || "N/A"} />
                          {canViewGuardVerifiedId && (
                            <DetailItem label="Hand Over Guard ID" value={data.handOverGuardId || "N/A"} />
                          )}
                          <DetailItem label="Verified Date" value={formatDate(data.guardVerifiedAt)} />
                          <DetailItem label="Verified Time" value={formatTime(data.guardVerifiedAt)} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-4 mt-12">
                  {canEdit && (
                    <button 
                      onClick={handleEdit}
                      className="px-10 py-3 rounded-xl font-bold text-[#0084c8] bg-blue-50 hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Pencil size={18} /> Edit Package
                    </button>
                  )}
                </div>
              </div>
            </div>
      </main>

    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
  isBadge?: boolean;
  badgeColor?: "green" | "yellow" | "blue";
}

function DetailItem({ label, value, isBadge = false, badgeColor = "green" }: DetailItemProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-0 items-start md:items-center group">
      <span className="text-gray-400 font-semibold text-sm md:text-base uppercase tracking-tight">
        {label}
      </span>
      <div className="flex items-center">
        {isBadge ? (
          <span className={`px-4 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
            badgeColor === "green" 
              ? "bg-[#e2f9ec] text-[#34d399]" 
              : badgeColor === "blue"
                ? "bg-[#dbeafe] text-[#3b82f6]"
                : "bg-[#fff9e6] text-[#f59e0b]"
          }`}>
            {value}
          </span>
        ) : (
          <span className="text-base md:text-xl font-bold text-[#334155]">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

export default function IncomingPackageDetail() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">Loading...</div>}>
      <IncomingPackageDetailContent />
    </Suspense>
  );
}

