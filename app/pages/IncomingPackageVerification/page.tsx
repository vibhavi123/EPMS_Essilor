"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import GuardIdModal from "@/components/GuardIdModal";
import GuardSelectionModal from "@/components/GuardSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import type { EmployeeData } from "@/utils/formTypes";
import {
  fetchPackageDetails,
  verifyPackageWithGuard,
  holdPackage,
  PackageDetailsResponse,
} from "@/lib/api/incomingPackageVerification";
import { PermissionGuard } from "@/hooks/usePermissions";
import { AlertCircle, Loader } from "lucide-react";
import { ROUTES } from "@/hooks/useNavigation";

function IncomingVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trackingNumber = searchParams.get("trackingNumber");
  const referenceNumber = searchParams.get("referenceNumber");
  // Fallback to id for backwards compatibility
  const id = searchParams.get("id");

  const [packageData, setPackageData] = useState<PackageDetailsResponse | null>(null);
  const [packageMode, setPackageMode] = useState("single");
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>([]);
  const [employeeBarcode, setEmployeeBarcode] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
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

  
  // Fetch package details from backend

  useEffect(() => {
    const loadPackageData = async () => {
      if (!trackingNumber && !referenceNumber && !id) {
        console.log("[IncomingPackageVerification] No package identifier - redirecting to list");
        setTimeout(() => {
          router.push("/pages/AllIncomingPackage");
        }, 500);
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const result = await fetchPackageDetails(trackingNumber || undefined, referenceNumber || undefined);

        if (!result.success || !result.data) {
          setLoadError(result.error || "Unable to load the package. Please verify the tracking number and try again.");
          return;
        }

        // CHECK IF ALREADY COMPLETED

        if (result.data.verificationStatus === "completed" || result.data.verificationStatus === "Completed") {
          setLoadError("This package has already been verified and cannot be verified again.");
          return;
        }

        setPackageData(result);
        setPackageMode(result.data.mode);
        if (result.data.trackingNumbers && result.data.trackingNumbers.length > 0) {
          setTrackingNumbers(result.data.trackingNumbers);
        } else if (result.data.trackingNumber) {
          setTrackingNumbers([result.data.trackingNumber]);
        } else {
          setTrackingNumbers([]);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setLoadError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadPackageData();
  }, [trackingNumber, referenceNumber, id, router]);

  const [showGuardSelectionModal, setShowGuardSelectionModal] = useState(false);
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [showHoldingStateModal, setShowHoldingStateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleEmployeeIdChange = (employeeId: string) => {
    setEmployeeBarcode(employeeId);

    if (!employeeId.trim()) {
      setSelectedEmployee(null);
    } else {
      setSelectedEmployee(null);
    }
  };

  const lookupEmployeeByBarcode = async (employeeId: string) => {
    const trimmedEmployeeId = employeeId.trim();

    if (!trimmedEmployeeId) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(trimmedEmployeeId)}`);
      const data = await response.json();

      if (!response.ok || !data?.success || !data?.data) {
        throw new Error(data?.message || "Employee not found");
      }

      setSelectedEmployee(data.data as EmployeeData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Employee not found";
      setSelectedEmployee(null);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    }
  };

  const handleSubmitClick = () => {
    if (!packageData?.data?.id) {
      setLoadError("Package data not loaded");
      return;
    }
    if (!selectedEmployee) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select an Employee",
        type: "warning",
      });
      return;
    }

    // First, show the guard selection modal
    setShowGuardSelectionModal(true);
  };

  const handleGuardAvailable = () => {
    // Close selection modal and show guard id modal
    setShowGuardSelectionModal(false);
    setShowGuardModal(true);
    setSubmitError(null);
  };

  const handleNoGuardAvailable = () => {
    // Close selection modal and show holding state modal
    setShowGuardSelectionModal(false);
    setShowHoldingStateModal(true);
    setSubmitError(null);
  };

  // API: Verify with Guard

  const handleSubmitWithGuard = async (guardId: string) => {
    if (!packageData?.data?.id) {
      setSubmitError("Package ID is missing");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await verifyPackageWithGuard(
        packageData.data.id,
        guardId.trim(),
        selectedEmployee?.employeeId?.trim() || null,
        selectedEmployee?.employeeName?.trim() || null,
        selectedEmployee?.employeeCompany?.trim() || null,
        selectedEmployee?.department?.trim() || null
      );

      if (!response.success) {
        setSubmitError(response.error || "Failed to verify package");
        return;
      }

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package verified successfully by guard!",
        type: "success",
      });

      // Redirect to all incoming packages list
      setTimeout(() => {
        router.push("/pages/AllIncomingPackage");
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // API: Place on Hold

  const handleSubmitHoldingState = async () => {
    if (!packageData?.data?.id) {
      setSubmitError("Package ID is missing");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await holdPackage(
        packageData.data.id,
        "Awaiting guard verification",
        selectedEmployee?.employeeId?.trim() || null,
        selectedEmployee?.employeeName?.trim() || null,
        selectedEmployee?.employeeCompany?.trim() || null,
        selectedEmployee?.department?.trim() || null
      );

      if (!response.success) {
        setSubmitError(response.error || "Failed to place package on hold");
        return;
      }

      setShowHoldingStateModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package placed on hold awaiting guard verification!",
        type: "success",
      });

      // Redirect to all incoming packages list
      setTimeout(() => {
        router.push("/pages/AllIncomingPackage");
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle error redirect
  useEffect(() => {
    if (loadError) {
      console.log("[IncomingPackageVerification] Error detected:", loadError);
      const redirectUrl = `/pages/error/incoming-verification-error?error=${encodeURIComponent(loadError)}`;
      console.log("[IncomingPackageVerification] Redirecting to:", redirectUrl);
      router.push(redirectUrl);
    }
  }, [loadError, router]);

  // Loading State

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-[#0084c8] animate-spin" />
            <p className="text-gray-600">Loading package details...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error State

  if (loadError) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all flex items-center justify-center">
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

        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">

        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
                Incoming package Verification
              </h1>
              <p className="text-sm text-gray-600 mt-1">Verify incoming packages before acceptance</p>
            </div>
            <Image 
              src="/images/IncomingPage.png" 
              alt="Incoming Package Verification" 
              width={192}
              height={192}
              className="w-48 h-48 object-contain shrink-0"
            />
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form className="max-w-7xl mx-auto space-y-12">
          
          {/* Section: Tracking Numbers - If Batch Mode */}
          {packageMode === "batch" && trackingNumbers.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
                Batch Tracking Numbers ({trackingNumbers.length} items)
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackingNumbers.map((tn, idx) => (
                  <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Item #{idx + 1}</p>
                    <p className="font-bold text-[#0c244c] text-lg break-all">{tn}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Single Tracking Number - If Single Mode */}
          {packageMode === "single" && trackingNumbers.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
                Tracking Number
              </h2>
              
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Single Package</p>
                <p className="font-bold text-[#0c244c] text-2xl break-all">{trackingNumbers[0]}</p>
              </div>
            </section>
          )}

            <button
              onClick={() => {
                  console.log("View Details button clicked");
                  console.log("Tracking numbers:", trackingNumbers);
                   if (trackingNumbers.length === 0) {
                          console.log("No tracking numbers available");
                          setAlertModal({
                            isOpen: true,
                            title: "No Package Data",
                            message: "Package tracking number is not available. Please go back and select a package.",
                            type: "warning",
                          });
                          return;
                        }
                        
                        const detailsUrl = `${ROUTES.PACKAGE_DETAILS.INCOMING}?trackingNumber=${trackingNumbers[0]}`;
                        console.log("Navigating to:", detailsUrl);
                        setIsNavigating(true);
                        router.push(detailsUrl);
                      }}
                      disabled={trackingNumbers.length === 0 || isNavigating}
                      className="bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isNavigating ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "View Package Details"
                      )}
            </button>
          {/* Section: Employee Information */}
          <section>
            <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
              Employee Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-10">
              
              <div className="md:col-span-6">
                <InputLabel label="Scan Employee Barcode *" />
                <input
                  type="text"
                  value={employeeBarcode}
                  placeholder="Scan Employee ID"
                  onChange={(e) => handleEmployeeIdChange(e.target.value)}
                  onBlur={(e) => {
                    void lookupEmployeeByBarcode(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupEmployeeByBarcode((e.currentTarget as HTMLInputElement).value);
                    }
                  }}
                  className="form-input-essilor"
                />
              </div>

              <div className="md:col-span-6">
                <InputLabel label="Employee Details" />
                <div className="w-full min-h-32 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  {selectedEmployee ? (
                    <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                      <div>
                        <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Name</span>
                        <div className="font-semibold text-[#0c244c]">{selectedEmployee.employeeName || "N/A"}</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Department</span>
                          <div>{selectedEmployee.department || "N/A"}</div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Company</span>
                          <div>{selectedEmployee.employeeCompany || "N/A"}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-24 items-center justify-center text-sm text-gray-500 text-center">
                      No employee details yet. Scan a barcode to load them.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-center md:justify-end pt-12">
            <button type="button" onClick={handleSubmitClick} className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 text-lg" >
              Submit for Verification
            </button>
          </div>
        </form>
      </main>

      {/* Submit Error Message */}
      {submitError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border-2 border-red-300 rounded-lg p-4 flex gap-3 max-w-sm z-40">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">{submitError}</p>
          </div>
        </div>
      )}

      {/* Guard Selection Modal - Choose if Guard is Available */}
      <GuardSelectionModal
        isOpen={showGuardSelectionModal}
        onClose={() => setShowGuardSelectionModal(false)}
        onGuardAvailable={handleGuardAvailable}
        onNoGuardAvailable={handleNoGuardAvailable}
      />

      {/* Guard ID Modal - If Guard is Available */}
      <GuardIdModal
        isOpen={showGuardModal}
        onClose={() => setShowGuardModal(false)}
        onSubmit={handleSubmitWithGuard}
        isSubmitting={isSubmitting}
      />

      {/* Holding State Modal - If No Guard Available */}
      <HoldingStateModal
        isOpen={showHoldingStateModal}
        onClose={() => setShowHoldingStateModal(false)}
        onConfirm={handleSubmitHoldingState}
        isSubmitting={isSubmitting}
        packageDetails={{
          customerName: packageData?.data?.customerName || "N/A",
          trackingNumber: trackingNumbers[0] || "N/A",
        }}
      />
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <style jsx>{`
        .form-input-essilor {
          width: 100%;
          padding: 0.85rem 1.25rem;
          background-color: #f1f3f5;
          border: 2px solid #ced4da;
          border-radius: 0.75rem;
          outline: none;
          font-size: 1rem;
          font-weight: 500;
          color: #495057;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .form-input-essilor:focus {
          background-color: #fff;
          border-color: #0084c8;
          box-shadow: 0 0 0 4px rgba(0, 132, 200, 0.1);
        }
        .form-input-essilor:read-only {
          background-color: #e2e8f0;
          cursor: not-allowed;
          color: #666;
        }
      `}</style>
      </div>
    </PermissionGuard>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-xl font-medium text-[#2d3748] mb-3 ml-1">
      {label}
    </label>
  );
}

export default function IncomingVerificationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <IncomingVerificationContent />
    </Suspense>
  );
}