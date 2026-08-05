"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import GuardIdModal from "@/components/GuardIdModal";
import EmployeeIdModal from "@/components/EmployeeIdModal";
import OutgoingVerificationGuardModel from "@/components/OutgoingVerificationGuardModel";
import AlertModal from "@/components/AlertModal";
import { Clock, AlertCircle } from "lucide-react";
import { HoldingPackage } from "@/utils/formTypes";
import {
  fetchHoldingPackages,
  verifyHoldingPackage,
} from "@/lib/api/holdingPackagesVerification";
import { PermissionGuard } from "@/hooks/usePermissions";

export default function VerifyHoldingPackagesPage() {
  const router = useRouter();
  const [holdingPackages, setHoldingPackages] = useState<HoldingPackage[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<HoldingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<HoldingPackage | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const reloadHoldingPackages = async () => {
    const result = await fetchHoldingPackages();

    if (!result.success || !result.data) {
      setHoldingPackages([]);
      return;
    }

    setHoldingPackages(result.data as HoldingPackage[]);
  };

  // Fetch holding packages
  useEffect(() => {
    const loadHoldingPackages = async () => {
      setLoading(true);
      try {
        await reloadHoldingPackages();
      } catch (error) {
        console.error("Error fetching holding packages:", error);
        setHoldingPackages([]);
      } finally {
        setLoading(false);
      }
    };

    loadHoldingPackages();
  }, []);

  // Filter packages based on search (only show pending)
  useEffect(() => {
    let filtered = holdingPackages.filter((pkg) => !pkg.verified);

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (pkg) =>
          (pkg.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (pkg.trackingNumbers?.some(tn => tn.toLowerCase().includes(searchTerm.toLowerCase())) ?? false) ||
            pkg.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (pkg.mode !== "single" && (pkg.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false))
      );
    }

    setFilteredPackages(filtered);
  }, [holdingPackages, searchTerm]);

  const handleVerifyClick = (pkg: HoldingPackage) => {
    setSelectedPackage(pkg);
    setShowVerificationModal(true);
  };

  const handleVerifyWithEmployee = async (
    employeeId: string,
    time: string,
    date: string
  ) => {
    if (!selectedPackage) return;

    setIsSubmitting(true);

    try {
      // Call API to verify holding package
      const result = await verifyHoldingPackage({
        id: selectedPackage.id,
        type: selectedPackage.type,
        mode: selectedPackage.mode,
        referenceNumber: selectedPackage.referenceNumber,
        employeeId: employeeId.trim(),
      });

      if (!result.success) {
        setAlertModal({
          isOpen: true,
          title: "Error",
          message: result.error || "Failed to verify package",
          type: "error",
        });
        return;
      }

      // Update the package status in local state
      setHoldingPackages((prev) =>
        selectedPackage.mode === "batch" && selectedPackage.referenceNumber
          ? prev.filter(
              (pkg) =>
                !(
                  pkg.type === selectedPackage.type &&
                  pkg.referenceNumber === selectedPackage.referenceNumber
                )
            )
          : prev.filter((pkg) => pkg.id !== selectedPackage.id)
      );

      console.log("Package Verified by Employee:", {
        packageId: selectedPackage.id,
        trackingNumber: selectedPackage.trackingNumber,
        employeeId,
        time,
        date,
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package verified successfully!",
        type: "success",
      });
      setShowVerificationModal(false);
      setSelectedPackage(null);
      await reloadHoldingPackages();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Verification error:", errorMessage);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to verify package. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyWithGuard = async (
    guardId: string,
    time: string,
    date: string
  ) => {
    if (!selectedPackage) return;

    setIsSubmitting(true);

    try {
      const result = await verifyHoldingPackage({
        id: selectedPackage.id,
        type: selectedPackage.type,
        mode: selectedPackage.mode,
        referenceNumber: selectedPackage.referenceNumber,
        guardId: guardId.trim(),
      });

      if (!result.success) {
        setAlertModal({
          isOpen: true,
          title: "Error",
          message: result.error || "Failed to verify package",
          type: "error",
        });
        return;
      }

      setHoldingPackages((prev) =>
        selectedPackage.mode === "batch" && selectedPackage.referenceNumber
          ? prev.filter(
              (pkg) =>
                !(
                  pkg.type === selectedPackage.type &&
                  pkg.referenceNumber === selectedPackage.referenceNumber
                )
            )
          : prev.filter((pkg) => pkg.id !== selectedPackage.id)
      );

      console.log("Package Verified by Guard:", {
        packageId: selectedPackage.id,
        trackingNumber: selectedPackage.trackingNumber,
        guardId,
        time,
        date,
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package verified successfully!",
        type: "success",
      });
      setShowVerificationModal(false);
      setSelectedPackage(null);
      
      // Route back to the matching list after verification
      if (selectedPackage.type === "incoming") {
        setTimeout(() => {
          router.push("/pages/AllIncomingPackage");
        }, 1500);
      } else if (selectedPackage.type === "outgoing" && selectedPackage.holdingReason === "Awaiting guard verification") {
        setTimeout(() => {
          router.push("/pages/AllOutgoingPackage");
        }, 1500);
      } else {
        await reloadHoldingPackages();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Verification error:", errorMessage);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to verify package. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PermissionGuard permission="verifyHoldingPackages">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
                Verify Holding Packages
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Review and verify packages placed in holding state
              </p>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-8" />

        {/* Filters Section */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by tracking number, customer, or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0c244c]"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <StatCard
            icon={Clock}
            label="Total Holding"
            count={holdingPackages.filter((p) => !p.verified).length}
            color="bg-blue-50"
            iconColor="text-blue-600"
          />
        </div>

        {/* Packages List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 text-center rounded-xl">
              <p className="text-gray-500">Loading packages...</p>
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl">
              <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No packages found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0c244c]">
                        Tracking #
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0c244c]">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0c244c]">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0c244c]">
                        Mode
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0c244c]">
                        Status
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-[#0c244c]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPackages.map((pkg) => (
                      <tr key={`${pkg.type}-${pkg.id}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          {pkg.trackingNumber && !pkg.trackingNumbers && (
                            <span className="font-semibold text-[#0c244c]">
                              {pkg.trackingNumber}
                            </span>
                          )}
                          {pkg.trackingNumbers && pkg.trackingNumbers.length > 0 && (
                            <div className="space-y-1">
                              {Array.from(new Set(pkg.trackingNumbers)).map((tn, idx) => (
                                <div key={idx} className="font-semibold text-[#0c244c]">
                                  {tn}
                                </div>
                              ))}
                            </div>
                          )}
                          {pkg.mode !== "single" && pkg.referenceNumber && (
                            <div className="font-semibold text-[#0c244c]">
                              Ref: {pkg.referenceNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {pkg.customerName}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              pkg.type === "incoming"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {pkg.type === "incoming" ? "Incoming" : "Outgoing"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              pkg.mode === "single"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {pkg.mode === "single" ? "Single" : "Batch"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            Holding
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!pkg.verified ? (
                            <button
                              onClick={() => handleVerifyClick(pkg)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0c244c] text-white rounded-lg hover:bg-[#0c2d5c] transition-colors font-medium"
                            >
                              Verify
                            </button>
                          ) : (
                            <span className="text-sm text-gray-500">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredPackages.map((pkg) => (
                  <div key={`${pkg.type}-${pkg.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="mb-4 pb-4 border-b border-gray-100">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
                        Tracking Number
                      </p>
                      {pkg.trackingNumber && !pkg.trackingNumbers && (
                        <p className="font-bold text-[#0c244c] text-lg mb-2">{pkg.trackingNumber}</p>
                      )}
                      {pkg.trackingNumbers && pkg.trackingNumbers.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {Array.from(new Set(pkg.trackingNumbers)).map((tn, idx) => (
                            <p key={idx} className="font-bold text-[#0c244c]">
                              {tn}
                            </p>
                          ))}
                        </div>
                      )}
                      {pkg.mode !== "single" && pkg.referenceNumber && (
                        <p className="font-bold text-[#0c244c] mb-2">Ref: {pkg.referenceNumber}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-800">{pkg.customerName}</p>
                    </div>

                    {/* Status Badges */}
                    <div className="mb-4 flex gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          pkg.type === "incoming"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {pkg.type === "incoming" ? "Incoming" : "Outgoing"}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          pkg.mode === "single"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {pkg.mode === "single" ? "Single" : "Batch"}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Holding
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 border-t border-gray-100">
                      {!pkg.verified ? (
                        <button
                          onClick={() => handleVerifyClick(pkg)}
                          className="w-full px-4 py-2.5 bg-[#0c244c] text-white rounded-lg hover:bg-[#0c2d5c] transition-colors font-bold text-sm"
                        >
                          Verify Package
                        </button>
                      ) : (
                        <p className="text-sm text-gray-500 text-center font-medium"> Verification Completed</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Verification Modal */}
        {selectedPackage?.type === "outgoing" && selectedPackage?.holdingReason === "Awaiting guard verification" && (
          <OutgoingVerificationGuardModel
            isOpen={showVerificationModal}
            onClose={() => {
              setShowVerificationModal(false);
              setSelectedPackage(null);
            }}
            onSubmit={handleVerifyWithGuard}
            isSubmitting={isSubmitting}
            packageDetails={{
              trackingNumber: selectedPackage.trackingNumber || (selectedPackage.trackingNumbers?.[0] || undefined),
              customerName: selectedPackage.customerName,
            }}
          />
        )}

        {selectedPackage?.type === "outgoing" && selectedPackage?.holdingReason !== "Awaiting guard verification" && (
          <EmployeeIdModal
            isOpen={showVerificationModal}
            onClose={() => {
              setShowVerificationModal(false);
              setSelectedPackage(null);
            }}
            onSubmit={handleVerifyWithEmployee}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedPackage?.type === "incoming" && (
          <GuardIdModal
            isOpen={showVerificationModal}
            onClose={() => {
              setShowVerificationModal(false);
              setSelectedPackage(null);
            }}
            onSubmit={handleVerifyWithGuard}
            isSubmitting={isSubmitting}
          />
        )}
      </main>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      </div>
    </PermissionGuard>
  );
}

// Helper component for stat cards
function StatCard({
  icon: Icon,
  label,
  count,
  color,
  iconColor,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
  color: string;
  iconColor: string;
}) {
  return (
    <div className={`${color} p-6 rounded-xl border border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-[#0c244c] mt-2">{count}</p>
        </div>
        <Icon size={32} className={`${iconColor} opacity-50`} />
      </div>
    </div>
  );
}
