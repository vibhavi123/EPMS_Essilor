"use client";

import React, { useState, useEffect, useCallback } from "react";
import { KeyRound, X, AlertCircle, CheckCircle, Loader } from "lucide-react";

interface AccessControlModalProps {
  isOpen: boolean;
  selectedUser: {
    accessId?: string;
    name?: string;
    username?: string;
    fullName?: string;
    type?: string;
    Username?: string;
    password?: string;
  } | null;
  onClose: () => void;
  onPermissionsSaved?: () => void;
}

interface UserPermissionsData {
  addOngoingPackage: boolean;
  addIncomePackage: boolean;
  addPackageEmployee: boolean;
  addPackageDescription: boolean;
  addPackageCustomer: boolean;
  addPackageDelivery: boolean;
  allPackagesView: boolean;
  allPackagesEdit: boolean;
  allPackagesDelete: boolean;
  outgoingVerification: boolean;
  incomeVerification: boolean;
  accessManagementAdd: boolean;
  accessManagementEdit: boolean;
  accessManagementControl: boolean;
  guardManagementAdd: boolean;
  guardManagementEdit: boolean;
  guardManagementDelete: boolean;
  guardManagementView: boolean;
  reportAccess: boolean;
  entryExitRecording: boolean;
  allEntryExitRecordsExport: boolean;
  verifyHoldingPackages: boolean;
  overdueEmployeeAlert: boolean;
  loginMonitor: boolean;
  employeeVerifiedIdView: boolean;
  guardVerifiedIdView: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissionsData = {
  addOngoingPackage: false,
  addIncomePackage: false,
  addPackageEmployee: false,
  addPackageDescription: false,
  addPackageCustomer: false,
  addPackageDelivery: false,
  allPackagesView: false,
  allPackagesEdit: false,
  allPackagesDelete: false,
  outgoingVerification: false,
  incomeVerification: false,
  accessManagementAdd: false,
  accessManagementEdit: false,
  accessManagementControl: false,
  guardManagementAdd: false,
  guardManagementEdit: false,
  guardManagementDelete: false,
  guardManagementView: false,
  reportAccess: false,
  entryExitRecording: true,
  allEntryExitRecordsExport: false,
  verifyHoldingPackages: false,
  overdueEmployeeAlert: false,
  loginMonitor: false,
  employeeVerifiedIdView: false,
  guardVerifiedIdView: false,
};

function ToggleSwitch({ isActive, onChange, disabled = false }: { isActive: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-16 h-8 rounded-full transition-colors ${
        disabled
          ? "bg-gray-200 cursor-not-allowed"
          : isActive
          ? "bg-[#17a2b8]"
          : "bg-gray-300"
      }`}
    >
      <div
        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
          isActive ? "translate-x-8" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AccessControlModal({ isOpen, selectedUser, onClose, onPermissionsSaved }: AccessControlModalProps) {
  const [permissions, setPermissions] = useState<UserPermissionsData>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [currentAccessId, setCurrentAccessId] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setAlert(null);
      const accessId = selectedUser?.accessId?.trim();

      if (!accessId) {
        setAlert({ type: "error", message: "Invalid access ID" });
        return;
      }

      const response = await fetch(`/api/permissions?accessId=${encodeURIComponent(accessId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load permissions");
      }

      // Map API response to component state
      if (data.data) {
        setPermissions({
          addOngoingPackage: Boolean(data.data.addOngoingPackage),
          addIncomePackage: Boolean(data.data.addIncomePackage),
          addPackageEmployee: Boolean(data.data.addPackageEmployee),
          addPackageDescription: Boolean(data.data.addPackageDescription),
          addPackageCustomer: Boolean(data.data.addPackageCustomer),
          addPackageDelivery: Boolean(data.data.addPackageDelivery),
          allPackagesView: Boolean(data.data.allPackagesView),
          allPackagesEdit: Boolean(data.data.allPackagesEdit),
          allPackagesDelete: Boolean(data.data.allPackagesDelete),
          outgoingVerification: Boolean(data.data.outgoingVerification),
          incomeVerification: Boolean(data.data.incomeVerification),
          accessManagementAdd: Boolean(data.data.accessManagementAdd),
          accessManagementEdit: Boolean(data.data.accessManagementEdit),
          accessManagementControl: Boolean(data.data.accessManagementControl),
          guardManagementAdd: Boolean(data.data.guardManagementAdd),
          guardManagementEdit: Boolean(data.data.guardManagementEdit),
          guardManagementDelete: Boolean(data.data.guardManagementDelete),
          guardManagementView: Boolean(data.data.guardManagementView),
          reportAccess: Boolean(data.data.reportAccess),
          entryExitRecording: Boolean(data.data.entryExitRecording),
          allEntryExitRecordsExport: Boolean(data.data.allEntryExitRecordsExport),
          verifyHoldingPackages: Boolean(data.data.verifyHoldingPackages),
          overdueEmployeeAlert: Boolean(data.data.overdueEmployeeAlert),
          loginMonitor: Boolean(data.data.loginMonitor),
          employeeVerifiedIdView: Boolean(data.data.employeeVerifiedIdView),
          guardVerifiedIdView: Boolean(data.data.guardVerifiedIdView),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load permissions";
      console.error("Error loading permissions:", error);
      setAlert({ type: "error", message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser?.accessId]);

  // Load permissions when modal opens
  useEffect(() => {
    if (isOpen && selectedUser?.accessId) {
      loadPermissions();
    }
    if (!isOpen) {
      setAlert(null);
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [isOpen, selectedUser?.accessId, loadPermissions]);

  // Fetch current user's accessId so we can prevent self-editing in the UI
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok && data?.data?.accessId) {
          setCurrentAccessId(String(data.data.accessId));
        } else {
          setCurrentAccessId(null);
        }
      } catch (err) {
        setCurrentAccessId(null);
      }
    };

    void fetchMe();
  }, []);

  const savePermissions = async () => {
    try {
      setIsSaving(true);
      setAlert(null);
      const accessId = selectedUser?.accessId?.trim();

      if (!accessId) {
        setAlert({ type: "error", message: "Invalid access ID" });
        return;
      }

      const response = await fetch("/api/permissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessId,
          ...permissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save permissions");
      }

      setAlert({ type: "success", message: "Permissions updated successfully!" });
      setTimeout(() => {
        onPermissionsSaved?.();
        onClose();
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save permissions";
      console.error("Error saving permissions:", error);
      setAlert({ type: "error", message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const userName = selectedUser?.fullName || selectedUser?.name || selectedUser?.username || selectedUser?.Username || "User";

  const isSelf = Boolean(selectedUser?.accessId && currentAccessId && selectedUser.accessId.trim() === currentAccessId.trim());

  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-linear-to-r from-[#17a2b8] to-[#138496] p-6 flex justify-between items-center text-white border-b border-[#0e6674]">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Access Control</h2>
              <p className="text-sm opacity-90">{userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alert Messages */}
        {isSelf && (
          <div className="mx-5 mt-4 p-4 rounded-lg flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">You cannot edit your own permissions from this panel.</span>
          </div>
        )}
        {alert && (
          <div
            className={`mx-5 mt-4 p-4 rounded-lg flex items-center gap-3 ${
              alert.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : alert.type === "error"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            {alert.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{alert.message}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 animate-spin text-[#17a2b8]" />
              <p className="text-gray-600 font-medium">Loading permissions...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Content */}
            <div className="p-5 space-y-3">
              {/* Add Ongoing Package access */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Add Ongoing Package access</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addOngoingPackage}
                        onChange={() => togglePermission("addOngoingPackage")}
                      />
              </div>

              {/* Add income Package access */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Add Income Package access</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addIncomePackage}
                        onChange={() => togglePermission("addIncomePackage")}
                      />
              </div>

              {/* Add Package - Subsections */}
              <div className="py-2 border-b border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-[#2d3748]">Add Package Subsections</span>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Employee</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addPackageEmployee}
                        onChange={() => togglePermission("addPackageEmployee")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Description</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addPackageDescription}
                        onChange={() => togglePermission("addPackageDescription")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Customer</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addPackageCustomer}
                        onChange={() => togglePermission("addPackageCustomer")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Delivery</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.addPackageDelivery}
                        onChange={() => togglePermission("addPackageDelivery")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* All packages */}
              <div className="py-2 border-b border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-[#2d3748]">All Packages</span>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">View</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.allPackagesView}
                        onChange={() => togglePermission("allPackagesView")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Edit</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.allPackagesEdit}
                        onChange={() => togglePermission("allPackagesEdit")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Delete</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.allPackagesDelete}
                        onChange={() => togglePermission("allPackagesDelete")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Outgoing Package Verification */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Outgoing Package Verification</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 font-medium">View</span>
                  <ToggleSwitch
                    disabled={isSaving || isSelf}
                    isActive={permissions.outgoingVerification}
                    onChange={() => togglePermission("outgoingVerification")}
                  />
                </div>
              </div>

              {/* Income Package Verification */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Income Package Verification</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 font-medium">View</span>
                  <ToggleSwitch
                    disabled={isSaving || isSelf}
                    isActive={permissions.incomeVerification}
                    onChange={() => togglePermission("incomeVerification")}
                  />
                </div>
              </div>

              {/* Access Management */}
              <div className="py-2 border-b border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-[#2d3748]">Access Management</span>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Add</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.accessManagementAdd}
                        onChange={() => togglePermission("accessManagementAdd")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Edit</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.accessManagementEdit}
                        onChange={() => togglePermission("accessManagementEdit")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Control</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.accessManagementControl}
                        onChange={() => togglePermission("accessManagementControl")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Guard Management */}
              <div className="py-2 border-b border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-[#2d3748]">Guard Management</span>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Add</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.guardManagementAdd}
                        onChange={() => togglePermission("guardManagementAdd")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Edit</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.guardManagementEdit}
                        onChange={() => togglePermission("guardManagementEdit")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">Delete</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.guardManagementDelete}
                        onChange={() => togglePermission("guardManagementDelete")}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1 font-medium">View</span>
                      <ToggleSwitch
                        disabled={isSaving || isSelf}
                        isActive={permissions.guardManagementView}
                        onChange={() => togglePermission("guardManagementView")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Report access */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Report Access</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.reportAccess}
                  onChange={() => togglePermission("reportAccess")}
                />
              </div>

              {/* Entry & Exit Recording */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Entry & Exit Recording</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.entryExitRecording}
                  onChange={() => togglePermission("entryExitRecording")}
                />
              </div>

              {/* All Entry & Exit Records Export CSV */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">All Entry & Exit Records - Export CSV</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.allEntryExitRecordsExport}
                  onChange={() => togglePermission("allEntryExitRecordsExport")}
                />
              </div>

              {/* Verify Holding Packages */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Verify Holding Packages</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.verifyHoldingPackages}
                  onChange={() => togglePermission("verifyHoldingPackages")}
                />
              </div>

              {/* Login Monitor */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Login Monitor</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.loginMonitor}
                  onChange={() => togglePermission("loginMonitor")}
                />
              </div>

              {/* Overdue Employee Alert */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Exit & Return Overdue Alert</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.overdueEmployeeAlert}
                  onChange={() => togglePermission("overdueEmployeeAlert")}
                />
              </div>

              {/* Employee Verified ID View */}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-lg font-semibold text-[#2d3748]">Employee Verified ID View</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.employeeVerifiedIdView}
                  onChange={() => togglePermission("employeeVerifiedIdView")}
                />
              </div>

              {/* Guard Verified ID View */}
              <div className="flex justify-between items-center py-2">
                <span className="text-lg font-semibold text-[#2d3748]">Guard Verified ID View</span>
                <ToggleSwitch
                  disabled={isSaving || isSelf}
                  isActive={permissions.guardVerifiedIdView}
                  onChange={() => togglePermission("guardVerifiedIdView")}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white flex gap-4 justify-center p-5 border-t border-gray-200">
              <button
                onClick={savePermissions}
                disabled={isSaving || isSelf}
                className="px-8 py-3 bg-[#17a2b8] hover:bg-[#138496] disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {isSaving && <Loader className="w-4 h-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-8 py-3 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
