"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import GuardIdModal from "@/components/GuardIdModal";
import GuardSelectionModal from "@/components/GuardSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import CustomerSelector from "@/components/CustomerSelector";
import DeliveryCompanySelector from "@/components/DeliveryCompanySelector";

import { incomingPackageDefaults } from "@/utils/formDefaults";
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

const vehicleTypes = ["Van", "Motorcycle", "Car", "Pickup", "Truck", "Three-Wheeler","Other"];

export default function SingleIncomingPackagePage() {
  const nav = useNavigation();
  const [formData, setFormData] = useState(() => ({
    ...incomingPackageDefaults,
    customerName: "",
  }));
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<DeliveryCompany | null>(null);

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

  const validateMandatoryFields = () => {
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

  const handleAddClick = () => {
    if (!validateMandatoryFields()) return;

    // Pre-check tracking number before proceeding
    const tn = formData.trackingNumber.trim();
    if (tn) {
      (async () => {
        try {
          const checkRes = await fetch(`/api/packages/incoming/details?trackingNumber=${encodeURIComponent(tn)}`);
          if (checkRes.ok) {
            setAlertModal({ isOpen: true, title: "Duplicate Tracking Number", message: `Tracking number ${tn} already exists. Please use a different tracking number.`, type: "error" });
            return;
          }
        } catch {
          // ignore network errors; server will validate on submit
        }

        // Normalize & validate vehicle before proceeding
        const normalizedVehicle = normalizePlate(formData.vehicleNumber);
        if (!validateSriLankanPlate(normalizedVehicle).startsWith("Valid")) {
          setAlertModal({ isOpen: true, title: "Invalid Vehicle", message: "Vehicle number format is invalid", type: "error" });
          return;
        }
        setFormData((prev) => ({ ...prev, vehicleNumber: normalizedVehicle }));

        // First, show the guard selection modal
        setShowGuardSelectionModal(true);
      })();
    } else {
      setShowGuardSelectionModal(true);
    }
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
    if (!formData.deliveryCompany.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Delivery Company",
        type: "warning",
      });
      setShowGuardModal(false);
      return;
    }
    if (!formData.deliveryPersonName.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Delivery person name",
        type: "warning",
      });
      setShowGuardModal(false);
      return;
    }
    if (!formData.vehicleNumber.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Vehicle number",
        type: "warning",
      });
      setShowGuardModal(false);
      return;
    }
    if (!formData.vehicleType.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Vehicle Type",
        type: "warning",
      });
      setShowGuardModal(false);
      return;
    }

    // Pre-submit duplicate check for this tracking number
    const tn = formData.trackingNumber.trim();
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

    setIsSubmitting(true);
    try {
      // Base package data (single mode uses only tracking number)
      const normalizedVehicle = normalizePlate(formData.vehicleNumber);
      const basePayload = {
        trackingNumber: formData.trackingNumber.trim(),
        mode: "single" as const,
        customerName: formData.customerName.trim(),
        time: time,
        date: date,
        deliveryCompany: formData.deliveryCompany.trim(),
        deliveryPersonName: formData.deliveryPersonName.trim() || undefined,
        vehicleNumber: normalizedVehicle || undefined,
        vehicleType: formData.vehicleType.trim() || undefined,
        remark: formData.remark.trim() || undefined,
      };

      // Build verified payload with guard info
      const payload = buildVerifiedPackagePayload(basePayload, guardId);

      // Save package via API
      await savePackage(payload);

      // Success
      setFormData({
        ...incomingPackageDefaults,
        customerName: "",
      });
      setSelectedCustomer(null);
      setSelectedDeliveryCompany(null);

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Pacakge submitted successfully!Guard ID, Verified by guard`,
        type: "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add package. Please try again.";
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
    if (!formData.deliveryCompany.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Delivery Company",
        type: "warning",
      });
      setShowHoldingStateModal(false);
      return;
    }
    if (!formData.deliveryPersonName.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Delivery person name",
        type: "warning",
      });
      setShowHoldingStateModal(false);
      return;
    }
    if (!formData.vehicleNumber.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter Vehicle number",
        type: "warning",
      });
      setShowHoldingStateModal(false);
      return;
    }
    if (!formData.vehicleType.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please select Vehicle Type",
        type: "warning",
      });
      setShowHoldingStateModal(false);
      return;
    }

    // Pre-submit duplicate check for this tracking number
    const tn = formData.trackingNumber.trim();
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

    setIsSubmitting(true);

    try {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const date = now.toLocaleDateString();

      // Base package data (single mode uses only tracking number)
      const basePayload = {
        trackingNumber: formData.trackingNumber.trim(),
        mode: "single" as const,
        customerName: formData.customerName.trim(),
        time: time,
        date: date,
        deliveryCompany: formData.deliveryCompany.trim(),
        deliveryPersonName: formData.deliveryPersonName.trim() || undefined,
        vehicleNumber: formData.vehicleNumber.trim() || undefined,
        vehicleType: formData.vehicleType.trim() || undefined,
        remark: formData.remark.trim() || undefined,
      };

      // Build holding payload (no guard)
      const payload = buildHoldingPackagePayload(basePayload);

      // Save package via API
      await savePackage(payload);

      // Success
      setFormData({
        ...incomingPackageDefaults,
        customerName: "",
      });
      setSelectedCustomer(null);
      setSelectedDeliveryCompany(null);

      setShowHoldingStateModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Package submitted successfully!,\n\nStatus: On Hold (Awaiting Guard Verification)`,
        type: "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add package. Please try again.";
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
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <br />

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">
              Single Incoming Package
            </h1>
            <p className="text-sm text-gray-600 mt-1">Register a single package arriving at the Company</p>
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
              Package Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-8 lg:col-span-6">
                <InputLabel label="Tracking Number *" />
                <input
                  type="text"
                  className={styles["form-input-custom"]}
                  value={formData.trackingNumber}
                  onChange={(e) => handleInputChange(e, "trackingNumber")}
                  placeholder="Enter tracking number"
                />
              </div>

              <div className="md:col-span-4 lg:col-span-3">
                <InputLabel label="Package Type" />
                <div className="w-full p-4 bg-[#e2e8f0] border border-gray-300 rounded-xl text-center font-bold text-gray-600">
                  Incoming
                </div>
              </div>

              <div className="md:col-span-12 lg:col-span-6">
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

          {/* Delivery Details */}
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
                    setFormData({
                      ...formData,
                      deliveryCompany: company?.deliveryCompany || "",
                    });
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
                  placeholder="Add any additional notes or remarks about this package..."
                />
              </div>
            </div>
          </section>

          {/* Buttons */}
          <div className="flex justify-center md:justify-end pt-8 pb-10 gap-4">
            <button
              type="button"
              onClick={() => nav.goToIncomingPackages()}
              className="w-full md:w-48 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleAddClick}
              className="w-full md:w-auto bg-[#0084c8] hover:bg-[#0071ad] text-white font-bold py-3 px-20 rounded-xl shadow-lg transition-all active:scale-95"
            >
              Submit Package
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
          customerName: formData.customerName,
          trackingNumber: formData.trackingNumber,
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
    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-lg md:text-xl font-medium text-[#4a5568] mb-2 ml-1">
      {label}
    </label>
  );
}
