"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import EmployeeIdModal from "@/components/EmployeeIdModal";
import EmployeeSelectionModal from "@/components/EmployeeSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import CustomerSelector from "@/components/CustomerSelector";
import PackageDescriptionSelector from "@/components/PackageDescriptionSelector";
import { outgoingPackageDefaults } from "@/utils/formDefaults";
import { useNavigation } from "@/hooks/useNavigation";
import {
  saveOutgoingPackage,
  buildVerifiedOutgoingPackagePayload,
  buildHoldingOutgoingPackagePayload,
  type BaseOutgoingPackageData,
} from "@/utils/apiClient";
import { EmployeeData, Customer, PackageDescription, EmployeeApiResponse } from "@/utils/formTypes";

export default function SingleOutgoingPackagePage() {
  const nav = useNavigation();
  const [formData, setFormData] = useState(() => ({
    ...outgoingPackageDefaults,
  }));
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPackageDescription, setSelectedPackageDescription] = useState<PackageDescription | null>(null);

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
    if (!selectedPackageDescription) missingFields.push("Package Description");
    if (!selectedEmployee) missingFields.push("Employee");
    if (selectedEmployee && !selectedEmployee.employeeId?.trim()) missingFields.push("Employee ID (from selected employee)");

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

    const tn = formData.trackingNumber.trim();
    if (tn) {
      (async () => {
        try {
          const checkRes = await fetch(`/api/packages/outgoing/details?trackingNumber=${encodeURIComponent(tn)}`);
          if (checkRes.ok) {
            setAlertModal({ isOpen: true, title: "Duplicate Tracking Number", message: `Tracking number ${tn} already exists. Please use a different tracking number.`, type: "error" });
            return;
          }
        } catch {
          // ignore network errors; server will validate on submit
        }
        setShowGuardSelectionModal(true);
      })();
    } else {
      setShowGuardSelectionModal(true);
    }
  };

  const handleGuardAvailable = () => {
    setShowGuardSelectionModal(false);
    setShowGuardModal(true);
  };

  const handleNoGuardAvailable = () => {
    setShowGuardSelectionModal(false);
    setShowHoldingStateModal(true);
  };

  const handleSubmitHoldingState = async (reason?: string) => {
    // Pre-submit duplicate check for this tracking number
    const tn = formData.trackingNumber.trim();
    if (tn) {
      try {
        const checkRes = await fetch(`/api/packages/outgoing/details?trackingNumber=${encodeURIComponent(tn)}`);
        if (checkRes.ok) {
          setAlertModal({ isOpen: true, title: "Duplicate Tracking Number", message: `Tracking number ${tn} already exists. Please use a different tracking number.`, type: "error" });
          return;
        }
      } catch {
        // ignore network errors; server will validate on submit
      }
    }

    setIsSubmitting(true);

    const now = new Date();
    const time = now.toLocaleTimeString();
    const date = now.toLocaleDateString();
    const emp = selectedEmployee;
    if (!emp) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "No employee selected. Please select an employee before submitting to Holding.",
        type: "warning",
      });
      setIsSubmitting(false);
      return;
    }

    const basePayload: BaseOutgoingPackageData = {
      trackingNumber: formData.trackingNumber.trim(),
      mode: "single" as const,
      customerName: formData.customerName?.trim(),
      packageDescription: formData.packageDescription.trim(),
      time,
      date,
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      employeeCompany: emp.employeeCompany,
      Department: emp.department,
    };

    try {
      const payload = buildHoldingOutgoingPackagePayload(basePayload);
      await saveOutgoingPackage(payload);

      setShowHoldingStateModal(false);
      setShowGuardSelectionModal(false);

      setFormData({
        ...outgoingPackageDefaults,
      });
      setSelectedEmployee(null);
      setSelectedCustomer(null);
      setSelectedPackageDescription(null);

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: reason
          ? `Outgoing package submitted and moved to Holding (awaiting employee verification). Reason: ${reason}`
          : "Outgoing package submitted and moved to Holding (awaiting employee verification).",
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to submit package: ${errorMessage}`,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWithGuard = async (guardId: string, time: string, date: string) => {
    // Pre-submit duplicate check for this tracking number
    const tn = formData.trackingNumber.trim();
    if (tn) {
      try {
        const checkRes = await fetch(`/api/packages/outgoing/details?trackingNumber=${encodeURIComponent(tn)}`);
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
      const emp = selectedEmployee;
      if (!emp) {
        setAlertModal({
          isOpen: true,
          title: "Validation Error",
          message: "No employee selected. Please select an employee before submitting.",
          type: "warning",
        });
        setIsSubmitting(false);
        return;
      }

      const basePayload: BaseOutgoingPackageData = {
        trackingNumber: formData.trackingNumber.trim(),
        mode: "single" as const,
        customerName: formData.customerName?.trim(),
        packageDescription: formData.packageDescription.trim(),
        time: time,
        date: date,
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        employeeCompany: emp.employeeCompany,
        Department: emp.department,
      };

      const payload = buildVerifiedOutgoingPackagePayload(basePayload, guardId.trim());
      await saveOutgoingPackage(payload);

      setFormData({
        ...outgoingPackageDefaults,
      });
      setShowGuardSelectionModal(false);
      setSelectedEmployee(null);
      setSelectedCustomer(null);
      setSelectedPackageDescription(null);

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Outgoing package submitted successfully and verified by employee!",
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to submit package: ${errorMessage}`,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEmployeeIdChange = (employeeId: string) => {
    setFormData((prev) => ({
      ...prev,
      employeeId,
    }));

    if (!employeeId.trim()) {
      setSelectedEmployee(null);
      return;
    }

    setSelectedEmployee(null);
  };

  const lookupEmployeeByBarcode = async (employeeId: string) => {
    const trimmedEmployeeId = employeeId.trim();

    if (!trimmedEmployeeId) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(trimmedEmployeeId)}`);
      const contentType = response.headers.get("content-type") || "";
      let data: EmployeeApiResponse;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Unexpected non-JSON response from server: ${response.status} ${response.statusText} - ${text.slice(0,200)}`);
      }

      if (!response.ok || !data?.success || !data?.data) {
        throw new Error(data?.message || "Employee not found");
      }

      const employee = data.data as EmployeeData;
      setSelectedEmployee(employee);
      setFormData((prev) => ({
        ...prev,
        employeeId: employee.employeeId || trimmedEmployeeId,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setSelectedEmployee(null);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: string
  ) =>{
    setFormData((prev) => ({ ...prev, [field]: e.target.value, }));
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <br />

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">
              Single Outgoing Package
            </h1>
            <p className="text-sm text-gray-600 mt-1">Register a single package leaving the Company</p>
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form className="space-y-10 max-w-7xl">
          {/* Package Information */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
              Package Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-4">
                <InputLabel label="Package Type" />
                <div className="w-full p-3 bg-[#e9ecef] border border-gray-300 rounded-lg text-center font-bold text-gray-500">
                  Outgoing
                </div>
              </div>

              <div className="md:col-span-6">
                <InputLabel label="Tracking Number *" />
                <input
                  type="text"
                  className="form-input-clean"
                  value={formData.trackingNumber ?? ""}
                  onChange={(e) => handleInputChange(e, "trackingNumber")}
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

              <div className="md:col-span-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Package Description *
                </label>
                <PackageDescriptionSelector
                  value={selectedPackageDescription}
                  onChange={(description) => {
                    setSelectedPackageDescription(description);
                    setFormData({
                      ...formData,
                      packageDescription: description?.packageDescription || "",
                    });
                  }}
                  placeholder="Select package description..."
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
            <div className="md:col-span-6">
              <InputLabel label="Scan Employee Barcode *" />
              <input
                type="text"
                value={formData.employeeId}
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
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0084c8] font-mono text-lg"
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

          <hr className="border-gray-200" />
          {/* Buttons */}
          <div className="flex justify-center md:justify-end pt-4 pb-12 gap-4">
            <button
              type="button"
              onClick={() => nav.goToOutgoingPackages()}
              className="w-full md:w-48 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleAddClick}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Submit Package
            </button>
          </div>
        </form>
      </main>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <EmployeeSelectionModal
        isOpen={showGuardSelectionModal}
        onClose={() => setShowGuardSelectionModal(false)}
        onEmployeeAvailable={handleGuardAvailable}
        onNoEmployeeAvailable={handleNoGuardAvailable}
      />
      <EmployeeIdModal
        isOpen={showGuardModal}
        onClose={() => setShowGuardModal(false)}
        onSubmit={handleSubmitWithGuard}
        isSubmitting={isSubmitting}
      />
      <HoldingStateModal
        isOpen={showHoldingStateModal}
        onClose={() => setShowHoldingStateModal(false)}
        onConfirm={handleSubmitHoldingState}
        isSubmitting={isSubmitting}
        packageDetails={{
          customerName: selectedCustomer?.customerName || formData.customerName || "Outgoing Package",
          trackingNumber: formData.trackingNumber || "N/A",
          employeeName: selectedEmployee?.employeeName,
        }}
      />
      <style jsx>{`
        .form-input-clean {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #f1f3f5;
          border: 1px solid #ced4da;
          border-radius: 0.5rem;
          outline: none;
          font-size: 1rem;
          color: #495057;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .form-input-clean:focus {
          background-color: #ffffff;
          border-color: #0084c8;
          box-shadow: 0 0 0 3px rgba(0, 132, 200, 0.1);
        }
        .form-input-clean:read-only {
          background-color: #e9ecef;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-lg font-medium text-[#2d3748] mb-2 ml-1">
      {label}
    </label>
  );
}
