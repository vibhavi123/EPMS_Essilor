"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import GuardIdModal from "@/components/GuardIdModal";
import GuardSelectionModal from "@/components/GuardSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import DeliveryCompanySelector from "@/components/DeliveryCompanySelector";
import { outgoingPackageVerificationDefaults } from "@/utils/formDefaults";
import {
  fetchPackageDetails,
  holdPackage,
  verifyPackageWithGuard,
} from "@/lib/api/outgoingPackageVerification";
import { Loader } from "lucide-react";
import { ROUTES } from "@/hooks/useNavigation";
import { DeliveryCompany } from "@/utils/formTypes";
import { PermissionGuard } from "@/hooks/usePermissions";
import { normalizePlate, validateSriLankanPlate } from "@/utils/plateValidator";

const vehicleTypes = ["Van", "Motorcycle", "Car", "Pickup", "Truck", "Three-Wheeler","Other"];

export default function OutgoingVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trackingNumber = searchParams.get("trackingNumber");
  const referenceNumber = searchParams.get("referenceNumber");
  const id = searchParams.get("id");
  
  const [packageData, setPackageData] = useState<{
    id: number;
    trackingNumber: string;
    mode: "single" | "batch";
    trackingNumbers?: string[];
  } | null>(null);
  const [packageMode, setPackageMode] = useState("single");
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>([]);
  const [formData, setFormData] = useState(outgoingPackageVerificationDefaults);
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<DeliveryCompany | null>(null);
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

  useEffect(() => {
    const loadPackageData = async () => {
      if (!trackingNumber && !referenceNumber && !id) {
        // Redirect to all outgoing packages to select one
        console.log("[OutgoingPackageVerification] No package identifier - redirecting to list");
        setTimeout(() => {
          router.push("/pages/AllOutgoingPackage");
        }, 500);
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const result = await fetchPackageDetails(trackingNumber || undefined, referenceNumber || id || undefined);

        if (!result.success || !result.data) {
          setLoadError(result.error || "Unable to load the package. Please verify the tracking number and try again.");
          return;
        }
        // CHECK IF ALREADY COMPLETED
        if (result.data.verificationStatus?.toLowerCase() === "completed") {
          setLoadError("This package has already been verified and cannot be verified again.");
          return;
        }

        // Handle batch vs single mode
        if (result.data.mode === "batch" && result.data.trackingNumbers) {
          setPackageMode("batch");
          setTrackingNumbers(result.data.trackingNumbers);
        } else {
          setPackageMode("single");
          setTrackingNumbers([result.data.trackingNumber]);
        }

        setPackageData({
          id: result.data.id,
          trackingNumber: result.data.trackingNumber,
          mode: result.data.mode,
          trackingNumbers: result.data.trackingNumbers,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
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

  const handleSubmitClick = () => {
    if (!packageData) {
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Package data not loaded. Please refresh the page.",
        type: "error",
      });
      return;
    }

    // Normalize vehicle number first
    const normalizedVehicle = normalizePlate(formData.vehicleNumber);
    setFormData((prev) => ({ ...prev, vehicleNumber: normalizedVehicle }));

    // Validate required fields
    if (!normalizedVehicle) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Vehicle Number",
        type: "warning",
      });
      return;
    }

    // Validate plate format
    const plateValidationMsg = validateSriLankanPlate(normalizedVehicle);
    if (!plateValidationMsg.startsWith("Valid")) {
      setAlertModal({ isOpen: true, title: "Invalid Vehicle", message: plateValidationMsg, type: "error" });
      return;
    }

    if (!formData.deliveryPersonName?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Delivery Person Name",
        type: "warning",
      });
      return;
    }

    if (!formData.vehicleType?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Vehicle Type",
        type: "warning",
      });
      return;
    }
    if (!formData.deliveryCompany?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Delivery Company",
        type: "warning",
      });
      return;
    }

    setShowGuardSelectionModal(true);
  };

  const handleGuardAvailable = () => {
    setShowGuardSelectionModal(false);
    setShowGuardModal(true);
  };

  const handleNoGuardAvailable = () => {
    setShowGuardSelectionModal(false);
    setShowHoldingStateModal(true);
  };

  //When guard provides ID and verification info
  const handleSubmitWithGuard = async (
    guardId: string
  ) => {
    if (!packageData) {
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Package data not available",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const vehicle = normalizePlate(formData.vehicleNumber);
      // extra validation server-side will apply, but block obvious invalids
      if (!validateSriLankanPlate(vehicle).startsWith("Valid")) {
        setAlertModal({ isOpen: true, title: "Invalid Vehicle", message: "Vehicle number format is invalid", type: "error" });
        setIsSubmitting(false);
        return;
      }

      const result = await verifyPackageWithGuard(
        packageData.id,
        guardId.trim(),
        formData.deliveryPersonName?.trim() || null,
        formData.deliveryCompany?.trim() || null,
        vehicle || null,
        formData.vehicleType?.trim() || null
      );

      if (!result.success) {
        setAlertModal({
          isOpen: true,
          title: "Verification Failed",
          message: result.error || "Failed to verify package",
          type: "error",
        });
        return;
      }

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package verified successfully by guard!",
        type: "success",
      });

      // Redirect to all outgoing packages list
      setTimeout(() => {
        router.push("/pages/AllOutgoingPackage");
      }, 1500);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to verify package: " + errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  //When guard is not available - place package on hold
  const handleSubmitHoldingState = async () => {
    if (!packageData) {
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Package data not available",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const vehicle = normalizePlate(formData.vehicleNumber);
      if (!validateSriLankanPlate(vehicle).startsWith("Valid")) {
        setAlertModal({ isOpen: true, title: "Invalid Vehicle", message: "Vehicle number format is invalid", type: "error" });
        setIsSubmitting(false);
        return;
      }

      const result = await holdPackage(
        packageData.id,
        "Awaiting guard verification",
        formData.deliveryPersonName?.trim() || null,
        formData.deliveryCompany?.trim() || null,
        vehicle || null,
        formData.vehicleType?.trim() || null
      );

      if (!result.success) {
        setAlertModal({
          isOpen: true,
          title: "Hold Failed",
          message: result.error || "Failed to place package on hold",
          type: "error",
        });
        return;
      }

      setShowHoldingStateModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Package placed on hold awaiting guard verification!",
        type: "success",
      });

      // Redirect to VerifyHoldingPackages for guard verification
      setTimeout(() => {
        router.push("/pages/VerifyHoldingPackages");
      }, 1500);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to place package on hold: " + errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Normalize and validate vehicle on Enter / blur
  const handleVehicleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = normalizePlate(formData.vehicleNumber);
      setFormData((prev) => ({ ...prev, vehicleNumber: val }));
      const msg = validateSriLankanPlate(val);
      setAlertModal({ isOpen: true, title: msg.startsWith("Valid") ? "Valid" : "Invalid", message: msg, type: msg.startsWith("Valid") ? "success" : "error" });
    }
  };

  const handleVehicleBlur = () => {
    const val = normalizePlate(formData.vehicleNumber);
    if (formData.vehicleNumber !== val) setFormData((prev) => ({ ...prev, vehicleNumber: val }));
  };

  // Handle error redirect
  useEffect(() => {
    if (loadError) {
      console.log("[OutgoingPackageVerification] Error detected:", loadError);
      const redirectUrl = `/pages/error/outgoing-verification-error?error=${encodeURIComponent(loadError)}`;
      console.log("[OutgoingPackageVerification] Redirecting to:", redirectUrl);
      router.push(redirectUrl);
    }
  }, [loadError, router]);

  // LOADING STATE

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


  // ERROR STATE

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
  // NOT FOUND STATE
  if (!packageData) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-300 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">
                Unable to Load Package
              </h2>
              <p className="text-red-700 mb-4">
                The package with reference number &quot;{referenceNumber}&quot; could not be found in the system.
              </p>
              <p className="text-red-700 text-sm">
                Please verify the reference number or tracking number and try again. If the problem persists, contact support.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PermissionGuard permission="outgoingVerification">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        
          {/* Header Section */}
          <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
            <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
                Outgoing package Verification
              </h1>
              <p className="text-sm text-gray-600 mt-1">Verify outgoing packages before dispatch</p>
            </div>
            <Image
              src="/images/OutgoingPage.png"
              alt="Outgoing Package Verification"
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
          
          {/* Section: Package Information - If Batch Mode */}
          {packageMode === "batch" && trackingNumbers.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
                Batch Tracking Numbers ({trackingNumbers.length})
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trackingNumbers.map((tn, idx) => (
                  <div
                    key={idx}
                    className="bg-red-50 border border-red-200 rounded-lg p-4"
                  >
                    <p className="text-sm text-gray-600 mb-1">
                      Tracking #{idx + 1}
                    </p>
                    <p className="font-bold text-[#0c244c] text-lg">{tn}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Package Information - If Single Mode */}
          {packageMode === "single" && trackingNumbers.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
                Package Tracking Number
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Tracking Number</p>
                <p className="font-bold text-[#0c244c] text-2xl">
                  {trackingNumbers[0]}
                </p>
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
              
              const detailsUrl = `${ROUTES.PACKAGE_DETAILS.OUTGOING}?trackingNumber=${trackingNumbers[0]}`;
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


          {/* Section: Delivery Information */}
          <section>
            <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">
              Delivery Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-10">
              
              <div>
                <InputLabel label="Vehicle number *" />
                <input 
                  type="text" 
                  className="form-input-essilor" 
                  value={formData.vehicleNumber}
                  onChange={(e) => handleInputChange(e, "vehicleNumber")}
                />
              </div>

              <div>
                <InputLabel label="Delivery person name *" />
                <input 
                  type="text" 
                  className="form-input-essilor" 
                  value={formData.deliveryPersonName}
                  onChange={(e) => handleInputChange(e, "deliveryPersonName")}
                />
              </div>

              <div>
                <InputLabel label="Vehicle Type *" />
                <select 
                  className="form-input-essilor" 
                  value={formData.vehicleType}
                  onChange={(e) => handleInputChange(e, "vehicleType")}
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <InputLabel label="Delivery Company *" />
                <DeliveryCompanySelector
                  value={selectedDeliveryCompany}
                  onChange={(company) => {
                    setSelectedDeliveryCompany(company);
                    setFormData((prev) => ({
                      ...prev,
                      deliveryCompany: company?.deliveryCompany || "",
                    }));
                  }}
                  placeholder="Select delivery company..."
                  required
                  onError={(err) => setAlertModal({
                    isOpen: true,
                    title: "Error",
                    message: err,
                    type: "error",
                  })}
                />
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-center md:justify-end pt-12 pb-10">
            <button
              type="button"
              onClick={handleSubmitClick}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 text-lg"
            >
              Submit
            </button>
          </div>
        </form>
      </main>

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
          customerName: "Outgoing Package",
          trackingNumber: "Verification",
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
