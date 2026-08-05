"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AlertModal from "@/components/AlertModal";
import CustomerSelector from "@/components/CustomerSelector";
import DeliveryCompanySelector from "@/components/DeliveryCompanySelector";
import { ChevronDown } from "lucide-react";
import { normalizePlate, validateSriLankanPlate } from "@/utils/plateValidator";
import { Customer, DeliveryCompany } from "@/utils/formTypes";

interface PackageData {
  trackingNumber: string;
  referenceNumber: string | null;
  mode: string;
  customerName: string;
  employeeName: string | null;
  verificationStatus?: string;
  employeeId: string | null;
  employeeCompany: string | null;
  department: string | null;
  deliverycompany: string;
  deliveryPersonName?: string;
  remarks?: string | null;
  vehicleNumber?: string;
  vehicleType?: string;
  date?: string;
  time?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  batchTrackingNumbers?: string[];
  guardId?: string | null;
  handOverGuardId?: string | null;
  guardVerificationStatus?: string;
  guardVerifiedAt?: string | null;
}

export default function IncomingPackageUpdatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackingNumber = searchParams.get("trackingNumber");

  const getUpdateLockKey = (recordTrackingNumber: string | null, status: string | null, mode?: string | null, referenceNumber?: string | null) => {
    if (!recordTrackingNumber || !status) return null;
    const st = String(status).trim().toLowerCase();
    // Use referenceNumber for batch mode, trackingNumber for single mode
    if (mode?.toString().toLowerCase() === "batch" && referenceNumber) {
      const ref = String(referenceNumber).trim().toUpperCase();
      return `incoming-update-lock:batch:${ref}:${st}`;
    }
    const tn = String(recordTrackingNumber).trim().toUpperCase();
    return `incoming-update-lock:${tn}:${st}`;
  };

  const [form, setForm] = useState<PackageData | null>(null);
  const [originalTrackingNumber, setOriginalTrackingNumber] = useState<string | null>(trackingNumber);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<DeliveryCompany | null>(null);
  const [batchTrackingNumbers, setBatchTrackingNumbers] = useState<string[]>([]);
  const [batchTrackingNumberInput, setBatchTrackingNumberInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lockedStatus, setLockedStatus] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        const hasEditPermission = Boolean(response.ok && result?.success && result?.data?.permissions?.allPackagesEdit);

        if (!mounted) return;

        if (!hasEditPermission) {
          router.replace("/pages/AllPackage/IncomingPackageDetails");
          return;
        }

        setCanEdit(true);
      } catch {
        if (mounted) {
          router.replace("/pages/AllPackage/IncomingPackageDetails");
        }
      }
    };

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!trackingNumber) {
      setLoading(false);
      setAlertModal({ isOpen: true, title: "Error", message: "Missing tracking number.", type: "error" });
      return;
    }

    if (!canEdit) {
      return;
    }

    const load = async () => {
      try {
        setLockedStatus(null);
        setLoading(true);
        const res = await fetch(`/api/packages/incoming/details?trackingNumber=${encodeURIComponent(trackingNumber)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load package details");
        const packageData = (json.data ?? null) as (PackageData & { deliveryCompany?: string; remark?: string }) | null;

        if (!packageData) {
          setForm(null);
          setOriginalTrackingNumber(trackingNumber);
          return;
        }

        const normalizedData: PackageData = {
          ...packageData,
          deliverycompany: packageData.deliverycompany ?? packageData.deliveryCompany ?? "",
          remarks: packageData.remarks ?? packageData.remark ?? null,
        };

          setForm(normalizedData);
          setOriginalTrackingNumber(normalizedData.trackingNumber ?? trackingNumber);
          setBatchTrackingNumbers(normalizedData.batchTrackingNumbers ?? []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An error occurred";
        setAlertModal({ isOpen: true, title: "Error", message: msg, type: "error" });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [trackingNumber, canEdit]);

  useEffect(() => {
    if (!form) {
      setSelectedCustomer(null);
      setSelectedDeliveryCompany(null);
      return;
    }

    setSelectedCustomer(
      form.customerName ? { id: 0, customerName: form.customerName } : null
    );
    setSelectedDeliveryCompany(
      form.deliverycompany ? { id: 0, deliveryCompany: form.deliverycompany } : null
    );
  }, [form]);

  useEffect(() => {
    const currentStatus = form?.verificationStatus?.toString().toLowerCase() ?? null;
    const currentTrackingNumber = (originalTrackingNumber ?? form?.trackingNumber ?? trackingNumber) as string | null;
    const currentMode = form?.mode as string | null;
    const currentReferenceNumber = form?.referenceNumber as string | null;
    const lockKey = getUpdateLockKey(currentTrackingNumber, currentStatus, currentMode, currentReferenceNumber);

    if (!lockKey || typeof window === "undefined") {
      setLockedStatus(null);
      return;
    }

    setLockedStatus(window.localStorage.getItem(lockKey) === "locked" ? currentStatus : null);
  }, [form?.verificationStatus, form?.trackingNumber, form?.mode, form?.referenceNumber, originalTrackingNumber, trackingNumber]);

  const handleChange = (field: keyof PackageData, value: string | null) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateBatchTrackingNumbers = (nextTrackingNumbers: string[]) => {
    setBatchTrackingNumbers(nextTrackingNumbers);
    setForm((prev) => (prev ? { ...prev, batchTrackingNumbers: nextTrackingNumbers } : prev));
  };

  // Normalize and validate vehicle number on Enter or on blur
  const handleVehicleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = normalizePlate(form?.vehicleNumber ?? "");
      handleChange("vehicleNumber", val);
      const msg = validateSriLankanPlate(val);
      setAlertModal({ isOpen: true, title: msg.startsWith("Valid") ? "Valid" : "Invalid", message: msg, type: msg.startsWith("Valid") ? "success" : "error" });
    }
  };

  const handleVehicleBlur = () => {
    const val = normalizePlate(form?.vehicleNumber ?? "");
    if (form?.vehicleNumber !== val) handleChange("vehicleNumber", val);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const isBatchMode = form.mode?.toString().toLowerCase() === "batch";
    const normalizedBatchTrackingNumbers = Array.from(
      new Set(
        batchTrackingNumbers
          .map((value) => String(value).trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (isBatchMode && normalizedBatchTrackingNumbers.length === 0) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "At least one tracking number is required for a batch package.",
        type: "warning",
      });
      return;
    }

    // Pre-submit validation: normalize and validate vehicle number
    const normalizedVehicle = normalizePlate(form.vehicleNumber ?? "");
    if (form.vehicleNumber !== normalizedVehicle) {
      handleChange("vehicleNumber", normalizedVehicle);
    }
    const vehicleMsg = validateSriLankanPlate(normalizedVehicle);
    if (normalizedVehicle && !vehicleMsg.startsWith("Valid")) {
      setAlertModal({ isOpen: true, title: "Invalid", message: vehicleMsg, type: "error" });
      return;
    }

    setIsSaving(true);
    try {
      const trackingNumberToUpdate = originalTrackingNumber ?? form.trackingNumber;
      const newTrackingNumber = form.trackingNumber;
      const trackingNumberChanged = trackingNumberToUpdate !== newTrackingNumber;

      const res = await fetch(`/api/packages/incoming`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          batchTrackingNumbers: normalizedBatchTrackingNumbers,
          originalTrackingNumber: trackingNumberToUpdate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const details = json?.details ? `\n\n${String(json.details)}` : "";
        throw new Error(`${json?.message || "Update failed"}${details}`);
      }

      const currentStatus = form.verificationStatus?.toString().toLowerCase() ?? null;
      // decide canonical tracking number to use for the lock: prefer server-returned value
      const serverReturnedTracking = String(json?.data?.trackingNumber || "").trim() || null;
      const lockTargetTrackingNumber = (serverReturnedTracking || (newTrackingNumber || trackingNumberToUpdate)) as string | null;
      const lockMode = form.mode as string | null;
      const lockReferenceNumber = form.referenceNumber as string | null;

      if (currentStatus && lockTargetTrackingNumber) {
        const lockKey = getUpdateLockKey(lockTargetTrackingNumber, currentStatus, lockMode, lockReferenceNumber);
        if (lockKey && typeof window !== "undefined") {
          window.localStorage.setItem(lockKey, "locked");
          setLockedStatus(currentStatus);
        }
      }

      let targetTrackingNumber = newTrackingNumber || trackingNumberToUpdate;
      if (isBatchMode) {
        const serverTrackingNumber = String(json?.data?.trackingNumber || "").trim();
        if (serverTrackingNumber) {
          targetTrackingNumber = serverTrackingNumber;
        } else if (!normalizedBatchTrackingNumbers.includes(targetTrackingNumber)) {
          targetTrackingNumber = normalizedBatchTrackingNumbers[0];
        }
      }

      // If tracking number changed (single mode), refetch package data with the new tracking number
      if (!isBatchMode && trackingNumberChanged) {
        try {
          const detailsRes = await fetch(`/api/packages/incoming/details?trackingNumber=${encodeURIComponent(newTrackingNumber)}`);
          const detailsJson = await detailsRes.json();
          if (detailsRes.ok && detailsJson.data) {
            const packageData = (detailsJson.data ?? null) as (PackageData & { deliveryCompany?: string; remark?: string }) | null;
            if (packageData) {
              const normalizedData: PackageData = {
                ...packageData,
                deliverycompany: packageData.deliverycompany ?? packageData.deliveryCompany ?? "",
                remarks: packageData.remarks ?? packageData.remark ?? null,
              };
              setForm(normalizedData);
              setOriginalTrackingNumber(normalizedData.trackingNumber ?? newTrackingNumber);
            }
          }
        } catch {
          // If refetch fails, still update originalTrackingNumber so state is consistent
          setOriginalTrackingNumber(newTrackingNumber);
        }
        router.replace(`?trackingNumber=${encodeURIComponent(newTrackingNumber)}`);
      } else {
        setOriginalTrackingNumber(targetTrackingNumber);
        router.replace(`?trackingNumber=${encodeURIComponent(targetTrackingNumber)}`);
      }

      setAlertModal({ isOpen: true, title: "Success", message: "Package updated successfully.", type: "success" });
      // Redirect to the package details page after successful update
      try {
        router.push(`/pages/AllPackage/IncomingPackageDetails?trackingNumber=${encodeURIComponent(targetTrackingNumber)}`);
        return;
      } catch {
        // If navigation fails, keep current behavior (show success modal)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Update failed";
      setAlertModal({ isOpen: true, title: "Error", message: msg, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };
 
  // Field access helpers based on verification status
  const verificationMode = form?.verificationStatus?.toString().toLowerCase();
  
  // Fields that belong to IncomingPackage page (editable in "verified" status)
  const incomingPackageFields = ["trackingNumber", "customerName", "deliverycompany", "deliveryPersonName", "vehicleNumber", "vehicleType", "remarks"];
  


  function isIncomingPackageField(field: string) {
    return incomingPackageFields.includes(field);
  }

  

  function isFieldDisabled(field: string) {
    if (!form) return false;
    
    const mode = verificationMode?.toLowerCase();
    
    // In "verified" status: can only edit IncomingPackage fields
    if (mode === "verified") {
      return !isIncomingPackageField(field);
    }
    
    // In "completed" status: no fields should be editable
    if (mode === "completed") {
      return true;
    }

    // Other statuses: no restrictions
    return false;
  }

  const vehicleTypes = ["Van", "Motorcycle", "Car", "Pickup", "Truck", "Three-Wheeler", "Other"];

  function canAddBatch() {
    if (!form) return false;
    return Boolean(form.customerName && form.deliverycompany);
  }

  const currentStatus = form?.verificationStatus?.toString().toLowerCase() ?? null;
  const isUpdateDisabled = isSaving || (currentStatus !== null && lockedStatus === currentStatus);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0084c8]" />
            <p className="mt-4 text-gray-600">Loading package details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  if (!form) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 font-bold mb-4 text-lg">Unable to Load Page</p>
            <button onClick={() => window.history.back()} className="bg-[#0084c8] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0071ad]">Go Back</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-6 md:p-12 pt-24 lg:pt-12">
        <form onSubmit={handleSave} className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-[#0c244c]">Update Incoming Package</h1>
          </header>
          <section className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Package Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
                {form.mode?.toString().toLowerCase() !== "batch" && (
                  <div className="md:col-span-6 lg:col-span-4">
                    <InputLabel label="Tracking Number" />
                    <input
                      type="text"
                      value={form.trackingNumber??""}
                      onChange={(e) => handleChange("trackingNumber", e.target.value)}
                      disabled={isFieldDisabled("trackingNumber")}
                      className="form-input-essilor"
                    />
                  </div>
                )}
                {form.mode?.toString().toLowerCase() === "batch" && (
                  <div className="md:col-span-6 lg:col-span-4">
                    <InputLabel label="Reference Number" />
                    <input
                      type="text"
                      value={form.referenceNumber ?? ""}
                      readOnly
                      className="form-input-essilor bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                )}
                <div className="md:col-span-12 lg:col-span-4">
                  <InputLabel label="Customer Name" />
                  <CustomerSelector
                    value={selectedCustomer}
                    onChange={(customer) => {
                      setSelectedCustomer(customer);
                      handleChange("customerName", customer?.customerName ?? "");
                    }}
                    placeholder="Select a customer..."
                    onError={(error) =>
                      setAlertModal({ isOpen: true, title: "Error", message: error, type: "error" })
                    }
                    disabled={isFieldDisabled("customerName")}
                  />
                </div>
              </div>
            </section>

            <hr className="border-gray-200" />

            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Employee Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
                <div className="md:col-span-6">
                  <InputLabel label="Employee Name" />
                  <div className="form-input-essilor bg-gray-100 cursor-not-allowed">
                    {form.employeeName || "N/A"}
                  </div>
                </div>
                <div className="md:col-span-6">
                  <InputLabel label="Employee Company" />
                  <div className="form-input-essilor bg-gray-100 cursor-not-allowed">
                    {form.employeeCompany || "N/A"}
                  </div>
                </div>
                <div className="md:col-span-6">
                  <InputLabel label="Department" />
                  <div className="form-input-essilor bg-gray-100 cursor-not-allowed">
                    {form.department || "N/A"}
                  </div>
                </div>
              </div>
            </section>
            <hr className="border-gray-200" />

            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Delivery Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
                <div className="md:col-span-6 lg:col-span-4">
                  <InputLabel label="Delivery Company" />
                  <DeliveryCompanySelector
                    value={selectedDeliveryCompany}
                    onChange={(deliveryCompany) => {
                      setSelectedDeliveryCompany(deliveryCompany);
                      handleChange("deliverycompany", deliveryCompany?.deliveryCompany ?? "");
                    }}
                    placeholder="Select a delivery company..."
                    onError={(error) =>
                      setAlertModal({ isOpen: true, title: "Error", message: error, type: "error" })
                    }
                    disabled={isFieldDisabled("deliverycompany")}
                  />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                  <InputLabel label="Delivery Person Name" />
                  <input
                    value={form.deliveryPersonName ?? ""}
                    onChange={(e) => handleChange("deliveryPersonName", e.target.value)}
                    className="form-input-essilor"
                    disabled={isFieldDisabled("deliveryPersonName")}
                    placeholder="Enter delivery person name"
                  />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                  <InputLabel label="Vehicle Number" />
                  <input
                    value={form.vehicleNumber ?? ""}
                    onChange={(e) => handleChange("vehicleNumber", e.target.value)}
                    onKeyDown={handleVehicleKeyDown}
                    onBlur={handleVehicleBlur}
                    className="form-input-essilor"
                    disabled={isFieldDisabled("vehicleNumber")}
                  />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                  <InputLabel label="Vehicle Type" />
                  <div className="relative">
                    <select
                      className="form-input-essilor appearance-none cursor-pointer pr-10"
                      value={form.vehicleType ?? ""}
                      onChange={(e) => handleChange("vehicleType", e.target.value)}
                      disabled={isFieldDisabled("vehicleType")}
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

            <section>
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Remarks</h2>
              <textarea
                value={form.remarks ?? ""}
                onChange={(e) => handleChange("remarks", e.target.value)}
                className="form-input-essilor min-h-32 w-full resize-y"
                disabled={isFieldDisabled("remarks")}
              />
            </section>

            {form.mode?.toString().toLowerCase() === "batch" && (
              <>
                <hr className="border-gray-200" />

                <section>
                  <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Batch Tracking Numbers</h2>

                  {batchTrackingNumbers.length > 0 && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-4">Tracking Numbers in this Batch ({batchTrackingNumbers.length})</p>
                      <div className="space-y-2">
                            {batchTrackingNumbers.map((tn, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white border border-blue-100 rounded p-3">
                            <span className="font-mono text-sm text-gray-700">{tn}</span>
                            <button
                              type="button"
                              onClick={() => updateBatchTrackingNumbers(batchTrackingNumbers.filter((_, i) => i !== idx))}
                              disabled={isSaving || verificationMode === "completed"}
                              className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-10">
                      <InputLabel label="Add Tracking Number" />
                      <input
                        type="text"
                        placeholder="Enter a new tracking number"
                        value={batchTrackingNumberInput}
                        onChange={(e) => setBatchTrackingNumberInput(e.target.value.toUpperCase())}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const candidate = batchTrackingNumberInput.trim().toUpperCase();
                            if (candidate && !batchTrackingNumbers.includes(candidate) && canAddBatch() && verificationMode !== "completed") {
                              updateBatchTrackingNumbers([...batchTrackingNumbers, candidate]);
                              setBatchTrackingNumberInput("");
                            }
                          }
                        }}
                        className="form-input-essilor"
                        disabled={isSaving || verificationMode === "completed"}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const candidate = batchTrackingNumberInput.trim().toUpperCase();
                          if (candidate && !batchTrackingNumbers.includes(candidate) && canAddBatch() && verificationMode !== "completed") {
                            updateBatchTrackingNumbers([...batchTrackingNumbers, candidate]);
                            setBatchTrackingNumberInput("");
                          }
                        }}
                        disabled={!batchTrackingNumberInput.trim() || batchTrackingNumbers.includes(batchTrackingNumberInput.trim().toUpperCase()) || isSaving || !canAddBatch() || verificationMode === "completed"}
                        className="w-full px-4 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isUpdateDisabled}
                className="px-6 py-2.5 rounded-xl bg-[#3ea5d9] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d8ab8]"
              >
                {isSaving ? "Saving..." : "Update"}
              </button>
            </div>
          </section>
        </form>

        <style jsx>{`
          .form-input-essilor {
            width: 100%;
            padding: 0.85rem 1.25rem;
            background-color: #f1f3f5;
            border: 1px solid #ced4da;
            border-radius: 0.75rem;
            outline: none;
            font-size: 1.125rem;
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

          .form-input-essilor:disabled {
            background-color: #e2e8f0;
            cursor: not-allowed;
            color: #666;
          }
        `}</style>

        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={() => setAlertModal((m) => ({ ...m, isOpen: false }))}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
        />
      </main>
    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-xl font-medium text-[#2d3748] mb-3 ml-1">
      {label}
    </label>
  );
}

