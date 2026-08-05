"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import EmployeeIdModal from "@/components/EmployeeIdModal";
import EmployeeSelectionModal from "@/components/EmployeeSelectionModal";
import HoldingStateModal from "@/components/HoldingStateModal";
import CustomerSelector from "@/components/CustomerSelector";
import PackageDescriptionSelector from "@/components/PackageDescriptionSelector";
import { outgoingPackageDefaults } from "@/utils/formDefaults";
import { BatchPackage, Customer, EmployeeData, PackageDescription } from "@/utils/formTypes";
import { fetchNextReferenceNumber } from "@/utils/idSequenceClient";
import { useNavigation } from "@/hooks/useNavigation";
import {
  saveOutgoingPackage,
  buildVerifiedOutgoingPackagePayload,
  buildHoldingOutgoingPackagePayload,
  type BaseOutgoingPackageData,
} from "@/utils/apiClient";
import { /* ChevronDown */ } from "lucide-react";

export default function BatchOutgoingPackagePage() {
  const nav = useNavigation();
  const [formData, setFormData] = useState(() => ({...outgoingPackageDefaults, referenceNumber: "", customerName: "", trackingNumber: "", }));

  const [batchPackages, setBatchPackages] = useState<BatchPackage[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
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

  const handleAddToBatch = async () => {
    if (!validateBatchPackageFields()) return;

    const tn = String(formData.trackingNumber || "").trim();
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

    const newPackage: BatchPackage = {
      id: Date.now(),
      trackingNumber: formData.trackingNumber,
      customerName: selectedCustomer!.customerName,
      packageDescription: selectedPackageDescription!.packageDescription,
      employeeName: selectedEmployee!.employeeName,
      employeeId: selectedEmployee!.employeeId,
      department: selectedEmployee!.department,
      employeeCompany: selectedEmployee!.employeeCompany,
    };

    setBatchPackages([...batchPackages, newPackage]);

    // Only reset Tracking Number for next entry
    setFormData((prev) => ({ 
      ...prev, 
      trackingNumber: "",
    }));
  };

  const handleAddToBatchWithEnter = () => {
    handleAddToBatch();
  };

  const handleRemoveFromBatch = (id: number) => {
    setBatchPackages(batchPackages.filter((pkg) => pkg.id !== id));
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

    setShowGuardSelectionModal(true);
  };

  const handleGuardAvailable = () => {
    setShowGuardSelectionModal(false);
    setShowGuardModal(true);
  };

  const handleNoGuardAvailable = () => {
    if (!selectedEmployee?.employeeId?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Selected employee is missing an Employee ID",
        type: "warning",
      });
      return;
    }

    setShowGuardSelectionModal(false);
    setShowHoldingStateModal(true);
  };

  const handleSubmitHoldingState = async (reason?: string) => {
    if (!selectedEmployee?.employeeId?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Selected employee is missing an Employee ID",
        type: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const time = now.toLocaleTimeString();
    const date = now.toLocaleDateString();     
      // proceed with submit
      try {
      const batchReferenceNumber = formData.referenceNumber || (await loadReferenceNumber());

      // Submit each package in holding state (no guard available)
      const submitPromises = batchPackages.map((pkg) => {
        const basePayload: BaseOutgoingPackageData = {
          trackingNumber: pkg.trackingNumber,
          referenceNumber: batchReferenceNumber,
          mode: "batch" as const,
          customerName: pkg.customerName,
          packageDescription: pkg.packageDescription || "",
          time: time,
          date: date,
          employeeId: pkg.employeeId || undefined,
          employeeName: pkg.employeeName,
          employeeCompany: pkg.employeeCompany,
          Department: pkg.department,
        };

        const payload = buildHoldingOutgoingPackagePayload(basePayload);
        return saveOutgoingPackage(payload);
      });

      await Promise.all(submitPromises);

      setFormData({
        ...outgoingPackageDefaults,
        referenceNumber: "",
        trackingNumber: "",
      });
      setBatchPackages([]);
      setSelectedEmployee(null);
      setSelectedCustomer(null);
      setSelectedPackageDescription(null);

      await loadReferenceNumber();

      setShowHoldingStateModal(false);

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: reason
          ? `Batch submitted and moved to Holding (awaiting employee verification). ${batchPackages.length} packages. Reason: ${reason}`
          : `Batch submitted and moved to Holding (awaiting employee verification). ${batchPackages.length} packages.`,
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to submit batch: ${errorMessage}`,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWithGuard = async (guardId: string, time: string, date: string) => {
    if (!selectedEmployee?.employeeId?.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Selected employee is missing an Employee ID",
        type: "warning",
      });
      setShowGuardModal(false);
      return;
    }
    setIsSubmitting(true);

    try {
      const batchReferenceNumber = formData.referenceNumber || (await loadReferenceNumber());

      // Submit each package in the batch
      const submitPromises = batchPackages.map((pkg) => {
        const basePayload: BaseOutgoingPackageData = {
          trackingNumber: pkg.trackingNumber,
          referenceNumber: batchReferenceNumber,
          mode: "batch" as const,
          customerName: pkg.customerName,
          packageDescription: pkg.packageDescription || "",
          time: time,
          date: date,
          employeeId: pkg.employeeId || undefined,
          employeeName: pkg.employeeName,
          employeeCompany: pkg.employeeCompany,
          Department: pkg.department,
        };

        const payload = buildVerifiedOutgoingPackagePayload(basePayload, guardId.trim());
        return saveOutgoingPackage(payload);
      });

      await Promise.all(submitPromises);

      setFormData({
        ...outgoingPackageDefaults,
        referenceNumber: "",
        trackingNumber: "",
      });
      setBatchPackages([]);
      setSelectedEmployee(null);
      setSelectedCustomer(null);
      setSelectedPackageDescription(null);

      await loadReferenceNumber();

      setShowGuardModal(false);
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Batch submitted successfully and verified by employee! ${batchPackages.length} packages.`,
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to submit batch: ${errorMessage}`,
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
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleEmployeeIdChange = (employeeId: string) => {
    setFormData((prev) => ({
      ...prev,
      employeeId,
    }));

    if (!employeeId.trim()) {
      setSelectedEmployee(null);
      setFormData((prev) => ({
        ...prev,
        employeeName: "",
        employeeCompany: "",
        Department: "",
      }));
      return;
    }

    setSelectedEmployee(null);
    setFormData((prev) => ({
      ...prev,
      employeeName: "",
      employeeCompany: "",
      Department: "",
    }));
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

      const employee = data.data as EmployeeData;
      setSelectedEmployee(employee);
      setFormData((prev) => ({
        ...prev,
        employeeId: employee.employeeId || trimmedEmployeeId,
        employeeName: employee.employeeName || "",
        employeeCompany: employee.employeeCompany || "",
        Department: employee.department || "",
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setSelectedEmployee(null);
      setFormData((prev) => ({
        ...prev,
        employeeName: "",
        employeeCompany: "",
        Department: "",
      }));
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    }
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
              Batch Outgoing Packages
            </h1>
            <p className="text-sm text-gray-600 mt-1">Register multiple packages with one Reference Number</p>
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form className="space-y-10 max-w-7xl">
          {/* Section 1: Batch Reference & Tracking */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
               Batch Reference & Tracking
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-6">
                <InputLabel label="Reference Number" />
                <input
                  type="text"
                  className="form-input-clean bg-[#e9ecef]"
                  value={formData.referenceNumber ?? ""}
                  placeholder="Generated on submit"
                  readOnly
                />
              </div>
              <div className="md:col-span-6">
                <InputLabel label="Tracking Number *" />
                <input
                  type="text"
                  className="form-input-clean"
                  value={formData.trackingNumber ?? ""}
                  onChange={(e) => handleInputChange(e, "trackingNumber")}
                  onKeyDown={(e) => e.key === "Enter" && handleAddToBatchWithEnter()}
                  placeholder="Enter tracking number"
                />
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Section 2: Package Details */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
              Package Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-4">
                <InputLabel label="Package Type" />
                <div className="w-full p-3 bg-[#e9ecef] border border-gray-300 rounded-lg text-center font-bold text-gray-500">
                  Outgoing
                </div>
              </div>

              <div className="md:col-span-4">
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

              <div className="md:col-span-4">
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

              {/* Delivery Company removed from this section per UX request */}
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Add to Batch Button */}
          <div className="flex justify-end pt-6 gap-4">
            <button
              type="button"
              onClick={handleAddToBatch}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition-all active:scale-95"
            >
              Add to Batch
            </button>
          </div>

          <hr className="border-gray-200" />
          {batchPackages.length > 0 && (
            <>
              <section>
                <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
                    Packages in Batch ({batchPackages.length})
                </h2>
                <div className="space-y-3">
                  {batchPackages.map((pkg: BatchPackage) => (
                    <div key={pkg.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-bold text-[#0c244c]">{pkg.trackingNumber}</p>
                      </div>
                      <button type="button" onClick={() => handleRemoveFromBatch(pkg.id)} className="ml-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all active:scale-95" >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

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
              onClick={handleSubmitClick}
              disabled={batchPackages.length === 0}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95"
            >
              Submit Batch
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
          customerName: selectedCustomer?.customerName || `${batchPackages.length} packages`,
          trackingNumber: formData.referenceNumber || "N/A",
          employeeName: selectedEmployee?.employeeName || "Multiple Packages",
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
