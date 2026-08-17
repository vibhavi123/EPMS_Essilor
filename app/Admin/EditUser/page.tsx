"use client";

import React, { useEffect, useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import AlertModal from "@/components/AlertModal";
import AccessControlModal from "@/components/AccessControlModal";
import { useSearchParams } from "next/navigation";
import { useNavigation } from "@/hooks/useNavigation";
import { KeyRound, ShieldCheck } from "lucide-react";

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

function EditUserContent() {
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
        const canAccessEdit = Boolean(permissions.accessManagementEdit || permissions.accessManagementControl);
        setViewerPermissions({
          accessManagementEdit: Boolean(permissions.accessManagementEdit),
          accessManagementControl: Boolean(permissions.accessManagementControl),
        });
        setHasPermission(canAccessEdit);
        if (!canAccessEdit) {
          nav.goToAllUsers();
        }
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
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <Sidebar />
        <main className="min-h-screen flex-1 lg:ml-72 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 animate-rise">
            <div className="size-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-navy">Checking permissions...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!hasPermission) return null;

  const isSuperAdmin = formData.role.toLowerCase() === "superadmin";

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-rise">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Access Control</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Edit User Profile</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsAccessControlOpen(true)}
                disabled={!viewerPermissions.accessManagementControl}
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
                title="Manage user permissions and access control"
              >
                <KeyRound className="size-4" />
                <span>Access Control</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => nav.goToAllUsers()}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
            >
              Back to Users
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-7 surface-card p-8 text-center text-sm text-muted-foreground animate-rise w-full">
            Loading user details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 w-full space-y-6 animate-rise">
            {isSuperAdmin && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 p-4 text-sm font-medium text-navy">
                <ShieldCheck className="size-5 text-primary shrink-0" />
                <span>Super Admin accounts automatically possess permanent full system control. Permissions cannot be restricted.</span>
              </div>
            )}

            <section className="surface-card p-6 sm:p-8 space-y-6 w-full">
              <h2 className="text-base font-bold text-navy border-b border-border pb-3">Account Information</h2>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Read-only Access ID */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Access ID (Read-only)</label>
                  <div className="flex h-11 items-center rounded-lg border border-dashed border-primary/40 bg-primary/6 px-3 font-mono text-sm font-bold text-navy">
                    {formData.accessId}
                  </div>
                </div>

                {/* Read-only Role */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Role (Read-only)</label>
                  <div className="flex h-11 items-center rounded-lg border border-border bg-secondary/50 px-3 text-sm font-semibold text-navy">
                    {formData.role}
                  </div>
                </div>

                {/* Editable Username */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Username *</label>
                  <input
                    type="text"
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    value={formData.username}
                    onChange={(e) => handleInputChange(e, "username")}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Editable Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Full Name *</label>
                  <input
                    type="text"
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange(e, "fullName")}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Company</label>
                  <input
                    type="text"
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    value={formData.company}
                    onChange={(e) => handleInputChange(e, "company")}
                    disabled={isSubmitting}
                  />
                </div>

                {/* User Status */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Account Status</label>
                  <select
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-navy transition-all hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
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

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Password (Optional)</label>
                  <input
                    type="password"
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Leave blank to keep current"
                    value={formData.password}
                    onChange={(e) => handleInputChange(e, "password")}
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Min 6 chars with a special symbol (e.g. @, #, $, !).
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Confirm Password</label>
                  <input
                    type="password"
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange(e, "confirmPassword")}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-wrap gap-2 border-t border-border pt-5 justify-end">
                <button
                  type="button"
                  onClick={() => nav.goToAllUsers()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!viewerPermissions.accessManagementEdit && !viewerPermissions.accessManagementControl)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-5 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
                >
                  {isSubmitting ? "Updating..." : "Update User"}
                </button>
              </div>
            </section>
          </form>
        )}

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

export default function EditUserPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">Loading...</div>}>
      <EditUserContent />
    </Suspense>
  );
}
