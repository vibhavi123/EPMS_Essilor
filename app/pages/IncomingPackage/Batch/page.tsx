"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import GuardIdModal from "@/components/GuardIdModal";
import GuardSelectionModal from "@/components/GuardSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import CustomerSelector from "@/components/CustomerSelector";
import DeliveryCompanySelector from "@/components/DeliveryCompanySelector";
import { incomingPackageDefaults } from "@/utils/formDefaults";
import { fetchNextReferenceNumber } from "@/utils/idSequenceClient";
import { useNavigation } from "@/hooks/useNavigation";
import {
  savePackage,
  buildVerifiedPackagePayload,
  buildHoldingPackagePayload,
} from "@/utils/apiClient";
import { ChevronDown } from "lucide-react";
import { normalizePlate, validateSriLankanPlate } from "@/utils/plateValidator";
import { Customer, DeliveryCompany } from "@/utils/formTypes";
import styles from "../styles.module.css";

interface BatchPackage {
  id: number;
  trackingNumber: string;
  customerName: string;
  deliveryCompany: string;
  deliveryPersonName: string;
  vehicleNumber: string;
  vehicleType: string;
}

const vehicleTypes = ["Van", "Motorcycle", "Car", "Pickup", "Truck", "Three-Wheeler", "Other"];



export default function BatchIncomingPackagePage() {
  const nav = useNavigation();
  const [formData, setFormData] = useState(() => ({ ...incomingPackageDefaults, referenceNumber: "", trackingNumber: "", customerName: "", }));
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<DeliveryCompany | null>(null);

  const [batchPackages, setBatchPackages] = useState<BatchPackage[]>([]);
  const [showGuardSelectionModal, setShowGuardSelectionModal] = useState(false);
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [showHoldingStateModal, setShowHoldingStateModal] = useState(false);
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

  const loadReferenceNumber = async () => {
    try {
      const nextReferenceNumber = await fetchNextReferenceNumber();
      setFormData((prev) => ({ ...prev, referenceNumber: nextReferenceNumber }));
      return nextReferenceNumber;
    } catch {
      setFormData((prev) => ({ ...prev, referenceNumber: "" }));
      return "";
    }
  };

  useEffect(() => {
    void loadReferenceNumber();
  }, []);

  const validateBatchPackageFields = () => {
    const missingFields: string[] = [];

    if (!formData.trackingNumber.trim()) missingFields.push("Tracking Number");
    if (!selectedCustomer) missingFields.push("Customer Name");
    if (!formData.deliveryCompany.trim()) missingFields.push("Delivery Company");
    if (!formData.deliveryPersonName.trim()) missingFields.push("Delivery person name");
    if (!formData.vehicleNumber.trim()) missingFields.push("Vehicle number");
    if (!formData.vehicleType.trim()) missingFields.push("Vehicle Type");

    if (missingFields.length > 0) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: `Please fill in all mandatory fields:\n\n${missingFields.map((f) => `• ${f}`).join("\n")}`,
        type: "warning",
      });
      return false;
    }
    return true;
  };

  const handleAddToBatch = () => {
    (async () => {
      if (!validateBatchPackageFields()) return;

      const tn = String(formData.trackingNumber || "").trim();
      if (tn) {
        try {
          const checkRes = await fetch(`/api/packages/incoming/details?trackingNumber=${encodeURIComponent(tn)}`);
          if (checkRes.ok) {
            setAlertModal({ isOpen: true, title: "Duplicate Tracking Number", message: `Tracking number ${tn} already exists. Please use a different tracking number.`, type: "error" });
            return;
          }
        } catch {
          // ignore network errors; server will validate on submit
        }
      }

      const normalizedVehicle = normalizePlate(formData.vehicleNumber);
      const plateMsg = validateSriLankanPlate(normalizedVehicle);
      if (!plateMsg.startsWith("Valid")) {
        setAlertModal({ isOpen: true, title: "Invalid Vehicle", message: plateMsg, type: "error" });
        return;
      }

      const newPackage = {
        id: Date.now(),
        trackingNumber: formData.trackingNumber,
        customerName: formData.customerName,
        deliveryCompany: formData.deliveryCompany,
        deliveryPersonName: formData.deliveryPersonName,
        vehicleNumber: normalizedVehicle,
        vehicleType: formData.vehicleType,
      };

      setBatchPackages([...batchPackages, newPackage]);

      // Only reset Tracking Number for next entry
      setFormData((prev) => ({
        ...prev,
        trackingNumber: "",
      }));
    })();
  };

  const handleRemoveFromBatch = (id: number) => {
    setBatchPackages(batchPackages.filter((pkg) => pkg.id !== id));
  };

  // Normalize and validate vehicle input on Enter / blur
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

  const findDuplicateTrackingNumbers = () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    batchPackages.forEach((pkg) => {
      const trackingNumber = pkg.trackingNumber.trim();
      if (!trackingNumber) {
        return;
      }

      if (seen.has(trackingNumber)) {
        duplicates.add(trackingNumber);
        return;
      }

      seen.add(trackingNumber);
    });

    return Array.from(duplicates);
  };

  const handleSubmitClick = () => {
    if (batchPackages.length === 0) {
      setAlertModal({
        isOpen: true,
        title: "Batch Empty",
        message: "Please add at least one package to the batch",
        type: "warning",
      });
      return;
    }

    const duplicateTrackingNumbers = findDuplicateTrackingNumbers();
    if (duplicateTrackingNumbers.length > 0) {
      setAlertModal({
        isOpen: true,
        title: "Duplicate Tracking Number",
        message: `Please remove duplicate tracking number before submitting:\n\n${duplicateTrackingNumbers.map((trackingNumber) => `• ${trackingNumber}`).join("\n")}`,
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
  };

  const handleNoGuardAvailable = () => {
    // Close selection modal and show holding state modal
    setShowGuardSelectionModal(false);
    setShowHoldingStateModal(true);
  };

  const handleSubmitWithGuard = async (guardId: string, time: string, date: string) => {
    setIsSubmitting(true);

    try {
      // Submit each package in the batch with the same reference number
      const submitPromises = batchPackages.map((pkg) => {
        const basePayload = {
          trackingNumber: pkg.trackingNumber.trim(),
          referenceNumber: formData.referenceNumber,
          mode: "batch" as const,
          customerName: pkg.customerName.trim(),
          time: time,
          date: date,
          deliveryCompany: pkg.deliveryCompany.trim(),
          deliveryPersonName: pkg.deliveryPersonName.trim() || undefined,
          vehicleNumber: pkg.vehicleNumber.trim() || undefined,
          vehicleType: pkg.vehicleType.trim() || undefined,
          remark: formData.remark.trim() || undefined,
        };
        const payload = buildVerifiedPackagePayload(basePayload, guardId);
        return savePackage(payload);
      });

      // Wait for all packages to be submitted
      const results = await Promise.all(submitPromises);

      // Check if any submissions failed
      const failedSubmissions = results.filter((r) => !r.success);

      if (failedSubmissions.length > 0) {
        const failedCount = failedSubmissions.length;
        throw new Error(
          `${failedCount} of ${batchPackages.length} packages failed. ` +
          `${failedSubmissions[0]?.message || "Unknown error"}`
        );
      }

      // Success
      setFormData({
        ...incomingPackageDefaults,
        referenceNumber: "",
        trackingNumber: "",
        customerName: "",
      });
      setBatchPackages([]);
      setSelectedCustomer(null);

      await loadReferenceNumber();

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Batch submitted successfully!Guard ID, Verified by guard`,
        type: "success",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit batch. Please try again.";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitHoldingState = async () => {
    setIsSubmitting(true);

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString();

    try {
      const batchReferenceNumber = formData.referenceNumber || (await loadReferenceNumber());

      // Submit each package in the batch with the same reference number
      const submitPromises = batchPackages.map((pkg) => {
        const basePayload = {
          trackingNumber: pkg.trackingNumber.trim(),
          referenceNumber: batchReferenceNumber,
          mode: "batch" as const,
          customerName: pkg.customerName.trim(),
          time: time,
          date: date,
          deliveryCompany: pkg.deliveryCompany.trim(),
          deliveryPersonName: pkg.deliveryPersonName.trim() || undefined,
          vehicleNumber: pkg.vehicleNumber.trim() || undefined,
          vehicleType: pkg.vehicleType.trim() || undefined,
          remark: formData.remark.trim() || undefined,
        };

        const payload = buildHoldingPackagePayload(basePayload);
        return savePackage(payload);
      });

      // Wait for all packages to be submitted
      const results = await Promise.all(submitPromises);

      // Check if any submissions failed
      const failedSubmissions = results.filter((r) => !r.success);

      if (failedSubmissions.length > 0) {
        const failedCount = failedSubmissions.length;
        throw new Error(
          `${failedCount} of ${batchPackages.length} packages failed. ` +
          `${failedSubmissions[0]?.message || "Unknown error"}`
        );
      }

      // Success
      setFormData({
        ...incomingPackageDefaults,
        referenceNumber: "",
        trackingNumber: "",
        customerName: "",
      });
      setBatchPackages([]);
      setSelectedCustomer(null);

      await loadReferenceNumber();

      setShowHoldingStateModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Batch submitted successfully!,\n\nStatus: On Hold (Awaiting Guard Verification)`,
        type: "success",
      });
      nav.goToIncomingPackages();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit batch. Please try again.";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    field: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value, }));
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <br />

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">
                Batch Incoming Packages
              </h1>
              <p className="text-sm text-gray-600 mt-1">Register multiple packages arriving together at the Company</p>
            </div>
            <Image
              src="/images/IncomingPage.png"
              alt="Incoming Package"
              width={192}
              height={192}
              className="object-contain shrink-0"
            />
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form className="space-y-8 md:space-y-12 max-w-6xl">
          {/* Section 1: Package Information */}
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-[#4a5568] mb-6">
              Batch Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-6">
                <InputLabel label="Reference Number " />
                <input
                  type="text"
                  className={`${styles["form-input-custom"]} ${styles["form-input-readonly"]}`}
                  value={formData.referenceNumber}
                  placeholder="Generated on submit"
                  readOnly
                />
              </div>
            <div className="md:col-span-4 lg:col-span-3">
                <InputLabel label="Package Type" />
                <div className="w-full p-4 bg-[#e2e8f0] border border-gray-300 rounded-xl text-center font-bold text-gray-600">
                  Incoming
                </div>
            </div>

              <div className="md:col-span-6">
                <InputLabel label="Tracking Number *" />
                <input
                  type="text"
                  className={styles["form-input-custom"]}
                  value={formData.trackingNumber}
                  onChange={(e) => handleInputChange(e, "trackingNumber")}
                  onKeyDown={(e) => e.key === "Enter" && handleAddToBatch()}
                  placeholder="Enter tracking number"
                />
              </div>

              <div className="md:col-span-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Customer Name *
                </label>
                <CustomerSelector
                  value={selectedCustomer}
                  onChange={(customer) => {
                    setSelectedCustomer(customer);
                    setFormData({
                      ...formData,
                      customerName: customer?.customerName || "",
                    });
                  }}
                  placeholder="Select a customer..."
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

          <hr className="border-gray-200" />

          {/* Additional Delivery Details */}
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-[#4a5568] mb-6">
              Delivery Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="relative">
                <InputLabel label="Delivery Company *" />
                <DeliveryCompanySelector
                  value={selectedDeliveryCompany}
                  onChange={(company) => {
                    setSelectedDeliveryCompany(company);
                    setFormData({ ...formData, deliveryCompany: company?.deliveryCompany || "" });
                  }}
                  placeholder="Select delivery company..."
                  required
                  onError={(err) => setAlertModal({ isOpen: true, title: "Error", message: err, type: "error" })}
                />
              </div>
              <div>
                <InputLabel label="Delivery person name *" />
                <input
                  type="text"
                  className={styles["form-input-custom"]}
                  value={formData.deliveryPersonName}
                  onChange={(e) => handleInputChange(e, "deliveryPersonName")}
                />
              </div>

              <div>
                <InputLabel label="Vehicle number *" />
                <input
                  type="text"
                  className={styles["form-input-custom"]}
                  value={formData.vehicleNumber}
                  onChange={(e) => handleInputChange(e, "vehicleNumber")}
                  onKeyDown={handleVehicleKeyDown}
                  onBlur={handleVehicleBlur}
                />
              </div>

              <div className="relative">
                <InputLabel label="Vehicle Type *" />
                <div className="relative">
                  <select
                    className={`${styles["form-input-custom"]} appearance-none cursor-pointer pr-10`}
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
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    size={20}
                  />
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Remarks Section */}
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-[#4a5568] mb-6">
              Additional Notes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-12">
                <InputLabel label="Remarks (Optional)" />
                <textarea
                  className={`${styles["form-input-custom"]} resize-none`}
                  rows={4}
                  value={formData.remark}
                  onChange={(e) => handleInputChange(e, "remark")}
                  placeholder="Add any additional notes or remarks about this batch..."
                />
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />
          {batchPackages.length > 0 && (
            <>
              <hr className="border-gray-200" />
              <section>
                <h2 className="text-xl md:text-2xl font-semibold text-[#4a5568] mb-6">
                  Packages in Batch ({batchPackages.length})
                </h2>
                <div className="space-y-3">
                  {batchPackages.map((pkg: BatchPackage) => (
                    <div key={pkg.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-bold text-[#0c244c]">{pkg.trackingNumber}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromBatch(pkg.id)}
                        className="ml-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Buttons */}
          <div className="flex justify-center md:justify-end pt-8 pb-10 gap-4">
            <button
              type="button"
              onClick={handleAddToBatch}
              className="w-full md:w-64 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Add to Batch
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-center md:justify-end pt-4 pb-10 gap-4">
            <button
              type="button"
              onClick={() => nav.goToIncomingPackages()}
              className="w-full md:w-48 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={batchPackages.length === 0}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Submit Batch
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
          customerName: `${batchPackages.length} packages`,
          trackingNumber: formData.referenceNumber,
          employeeName: "Multiple Packages",
        }}
      />
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-lg md:text-xl font-medium text-[#4a5568] mb-2 ml-1">
      {label}
    </label>
  );
}

// 
