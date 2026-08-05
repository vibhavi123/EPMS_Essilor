"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AlertModal from "@/components/AlertModal";
import AccessControlModal from "@/components/AccessControlModal";
import { useSearchParams } from "next/navigation";
import { useNavigation } from "@/hooks/useNavigation";
import { KeyRound } from "lucide-react";

type UserFormState = {
  id: number;
  accessId: string;
  username: string;
  fullName: string;
  role: string;
  company: string;
  isActive: boolean;
  password: string;
  confirmPassword: string;
};

type ViewerPermissions = {
  accessManagementEdit: boolean;
  accessManagementControl: boolean;
};

export default function EditUserPage() {
  const nav = useNavigation();
  const searchParams = useSearchParams();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const userId = searchParams.get("id");

  const [formData, setFormData] = useState<UserFormState>({
    id: 0,
    accessId: "",
    username: "",
    fullName: "",
    role: "",
    company: "",
    isActive: true,
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
  });
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>({
    accessManagementEdit: false,
    accessManagementControl: false,
  });

  useEffect(() => {
    async function loadMyPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAllUsers();
          return;
        }
        const permissions = data?.data?.permissions ?? {};
        const canEditUsers = Boolean(permissions.accessManagementEdit);
        if (!canEditUsers) {
          nav.goToAllUsers();
          return;
        }
        setViewerPermissions({
          accessManagementEdit: Boolean(permissions.accessManagementEdit),
          accessManagementControl: Boolean(permissions.accessManagementControl),
        });
        setHasPermission(true);
      } catch {
        nav.goToAllUsers();
      } finally {
        setIsCheckingPermissions(false);
      }
    }
    void loadMyPermissions();
  }, [nav]);

  useEffect(() => {
    if (!userId) return;

    const loadUser = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load user");
        }

        const user = data.data;
        setFormData({
          id: user.id,
          accessId: user.accessId || "",
          username: user.username || "",
          fullName: user.fullName || "",
          role: user.role || "",
          company: user.company || "",
          isActive: Boolean(user.isActive),
          password: "",
          confirmPassword: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load user";
        setAlertModal({
          isOpen: true,
          title: "Load Failed",
          message,
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadUser();
  }, [userId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof UserFormState
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewerPermissions.accessManagementEdit && !viewerPermissions.accessManagementControl) {
      setAlertModal({
        isOpen: true,
        title: "Access Denied",
        message: "You do not have permission to edit user accounts.",
        type: "error",
      });
      return;
    }

    if (!formData.username || !formData.fullName) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Username and Full Name are required.",
        type: "warning",
      });
      return;
    }

    if (formData.password || formData.confirmPassword) {
      if (formData.password.length < 6) {
        setAlertModal({
          isOpen: true,
          title: "Validation Error",
          message: "New password must be at least 6 characters long.",
          type: "warning",
        });
        return;
      }
      if (!/[^a-zA-Z0-9]/.test(formData.password)) {
        setAlertModal({
          isOpen: true,
          title: "Validation Error",
          message: "New password must contain at least one special character (e.g. @, #, $, !, %, &).",
          type: "warning",
        });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setAlertModal({
          isOpen: true,
          title: "Validation Error",
          message: "Passwords do not match.",
          type: "warning",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, string> = {
        username: formData.username,
        fullName: formData.fullName,
        company: formData.company,
      };

      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      const response = await fetch(`/api/users/${formData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update user");
      }

      setAlertModal({
        isOpen: true,
        title: "User Updated",
        message: "User information has been updated successfully.",
        type: "success",
      });

      setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update user";
      setAlertModal({
        isOpen: true,
        title: "Update Failed",
        message,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
          <div className="max-w-7xl mx-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            No user selected. Please select a user from the All Users list.
          </div>
        </main>
      </div>
    );
  }

  if (isCheckingPermissions) {
    return (
      <div className="flex h-screen bg-[#f8f9fc]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">Edit User</h1>
            <p className="mt-2 text-sm text-gray-500">Update user information. Only specific fields can be edited.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAccessControlOpen(true)}
            disabled={!viewerPermissions.accessManagementControl}
            className="flex items-center gap-2 px-4 py-2 bg-[#17a2b8] hover:bg-[#138496] text-white font-bold rounded-lg transition-all"
            title="Manage user permissions and access control"
          >
            <KeyRound className="w-5 h-5" />
            <span className="whitespace-nowrap">Access Control</span>
          </button>
        </header>

        <hr className="border-gray-300 mb-10" />

        {isLoading ? (
          <div className="max-w-7xl mx-auto rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
            Loading user details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Account Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Read-only fields */}
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Access ID (Read-only)</label>
                  <input
                    type="text"
                    className="form-input-essilor bg-gray-100"
                    value={formData.accessId}
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Role (Read-only)</label>
                  <input
                    type="text"
                    className="form-input-essilor bg-gray-100"
                    value={formData.role}
                    readOnly
                  />
                </div>

                {/* Editable fields */}
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Username *</label>
                  <input
                    type="text"
                    className="form-input-essilor"
                    value={formData.username}
                    onChange={(e) => handleInputChange(e, "username")}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Full Name *</label>
                  <input
                    type="text"
                    className="form-input-essilor"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange(e, "fullName")}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Company</label>
                  <input
                    type="text"
                    className="form-input-essilor"
                    value={formData.company}
                    onChange={(e) => handleInputChange(e, "company")}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">User Status</label>
                  <select
                    className="form-input-essilor"
                    value={formData.isActive ? "active" : "deactivated"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isActive: e.target.value === "active",
                      }))
                    }
                    disabled={isSubmitting}
                  >
                    <option value="active">Active</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Password (Optional)</label>
                  <input
                    type="password"
                    className="form-input-essilor"
                    placeholder="Leave blank to keep current password"
                    value={formData.password}
                    onChange={(e) => handleInputChange(e, "password")}
                    disabled={isSubmitting}
                  />
                  <p className="mt-1.5 text-xs font-medium text-gray-500">
                    If changing, must be at least 6 characters with a special character (e.g. @, #, $, !).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2d3748] mb-3">Confirm Password</label>
                  <input
                    type="password"
                    className="form-input-essilor"
                    placeholder="Confirm the new password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange(e, "confirmPassword")}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="mt-10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => nav.goToAllUsers()}
                  className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!viewerPermissions.accessManagementEdit && !viewerPermissions.accessManagementControl)}
                  className="px-6 py-3 rounded-xl bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold transition-all active:scale-95"
                >
                  {isSubmitting ? "Updating..." : "Update User"}
                </button>
              </div>
            </section>
          </form>
        )}

        <style jsx>{`
          .form-input-essilor {
            width: 100%;
            padding: 0.85rem 1.25rem;
            background-color: #f1f3f5;
            border: 1px solid #ced4da;
            border-radius: 0.75rem;
            outline: none;
            font-size: 1rem;
            font-weight: 500;
            color: #495057;
            transition: all 0.2s ease;
          }

          .form-input-essilor:focus {
            background-color: #fff;
            border-color: #0084c8;
            box-shadow: 0 0 0 4px rgba(0, 132, 200, 0.1);
          }

          .form-input-essilor:disabled {
            background-color: #e9ecef;
            color: #6c757d;
            cursor: not-allowed;
          }
        `}</style>
      </main>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      <AccessControlModal
        isOpen={isAccessControlOpen}
        selectedUser={
          formData.id
            ? {
                accessId: formData.accessId,
                fullName: formData.fullName,
                username: formData.username,
              }
            : null
        }
        onClose={() => setIsAccessControlOpen(false)}
        onPermissionsSaved={() => {
          // Optional: show success notification
          console.log("Permissions saved successfully");
        }}
      />
    </div>
  );
}
