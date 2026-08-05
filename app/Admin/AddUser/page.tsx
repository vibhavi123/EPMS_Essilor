"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AlertModal from "@/components/AlertModal";
import { ChevronDown, UserPlus, Copy, Check } from "lucide-react";
import { useNavigation } from "@/hooks/useNavigation";
import { fetchNextAccessId } from "@/utils/idSequenceClient";

type UserFormState = {
  accessId: string;
  username: string;
  fullName: string;
  role: "Employee" | "admin" | "guard" | "superAdmin";
  department: string;
  company: string;
  password: string;
  confirmPassword: string;
};

type CreatedUser = {
  id: number;
  accessId: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  company: string | null;
  createdAt?: string;
};

export default function AccessManagementPage() {
  const nav = useNavigation();
  const [canAddUsers, setCanAddUsers] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [formData, setFormData] = useState<UserFormState>({
    accessId: "",
    username: "",
    fullName: "",
    role: "guard",
    department: "",
    company: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copiedAccessId, setCopiedAccessId] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
  });

  const loadAccessId = async (role: UserFormState["role"]) => {
    try {
      const nextAccessId = await fetchNextAccessId(role);
      setFormData((prev) => ({ ...prev, accessId: nextAccessId }));
    } catch {
      setFormData((prev) => ({ ...prev, accessId: "" }));
    }
  };

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAllUsers();
          return;
        }
        const hasPermission = Boolean(data?.data?.permissions?.accessManagementAdd);
        if (!hasPermission) {
          nav.goToAllUsers();
          return;
        }
        setCanAddUsers(true);
      } catch {
        nav.goToAllUsers();
      } finally {
        setIsCheckingPermissions(false);
      }
    }
    void checkPermissions();
  }, [nav]);

  useEffect(() => {
    void loadAccessId(formData.role);
  }, [formData.role]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof UserFormState
  ) => {
    const value = e.target.value as UserFormState[keyof UserFormState];
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      accessId: "",
      username: "",
      fullName: "",
      role: "guard",
      department: "",
      company: "",
      password: "",
      confirmPassword: "",
    });
    setCopiedAccessId(false);
  };

  const copyAccessIdToClipboard = () => {
    navigator.clipboard.writeText(formData.accessId);
    setCopiedAccessId(true);
    setTimeout(() => setCopiedAccessId(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canAddUsers) {
      setAlertModal({
        isOpen: true,
        title: "Access Denied",
        message: "You do not have permission to create user accounts.",
        type: "error",
      });
      return;
    }

    if (!formData.username || !formData.fullName) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Username and full name are required.",
        type: "warning",
      });
      return;
    }

    if (formData.password.length < 6) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Password must be at least 6 characters long.",
        type: "warning",
      });
      return;
    }

    if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Password must contain at least one special character (e.g. @, #, $, !, %, &).",
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

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessId: formData.accessId,
          username: formData.username,
          fullName: formData.fullName,
          role: formData.role,
          department: formData.department,
          company: formData.company,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create user");
      }

      setCreatedUser(data.data);
      setAlertModal({
        isOpen: true,
        title: "User Created",
        message: data.message || "The account has been saved successfully.",
        type: "success",
      });
      resetForm();
      void loadAccessId("guard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create user";
      setAlertModal({
        isOpen: true,
        title: "Create Failed",
        message,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (!canAddUsers) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">User Management</h1>
            <p className="mt-2 text-sm text-gray-500">
              Create login accounts for employees, guards, admins, and super admins.
            </p>
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-[#4a5568] mb-8">Account Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10">
              <div>
                <InputLabel label="Access ID" />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="form-input-essilor flex-1"
                    value={formData.accessId}
                    readOnly
                    disabled
                    placeholder="Generated on save"
                  />
                  <button
                    type="button"
                    onClick={copyAccessIdToClipboard}
                    className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors shrink-0"
                    title="Copy Access ID"
                  >
                    {copiedAccessId ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <InputLabel label="Username" />
                <input
                  type="text"
                  className="form-input-essilor"
                  value={formData.username}
                  onChange={(e) => handleInputChange(e, "username")}
                  autoComplete="username"
                />
              </div>

              <div>
                <InputLabel label="Full Name" />
                <input
                  type="text"
                  className="form-input-essilor"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange(e, "fullName")}
                />
              </div>

              <div className="relative">
                <InputLabel label="Role" />
                <div className="relative">
                  <select
                    className="form-input-essilor appearance-none cursor-pointer pr-10"
                    value={formData.role}
                    onChange={(e) => handleInputChange(e, "role")}
                  >
                    <option value="Employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="guard">Guard</option>
                    <option value="superAdmin">Super Admin</option>
                  </select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    size={20}
                  />
                </div>
              </div>

              <div>
                <InputLabel label="Department" />
                <input
                  type="text"
                  className="form-input-essilor"
                  value={formData.department}
                  onChange={(e) => handleInputChange(e, "department")}
                />
              </div>

              <div>
                <InputLabel label="Company" />
                <input
                  type="text"
                  className="form-input-essilor"
                  value={formData.company}
                  onChange={(e) => handleInputChange(e, "company")}
                />
              </div>

              <div>
                <InputLabel label="Password" />
                <input
                  type="password"
                  className="form-input-essilor"
                  value={formData.password}
                  onChange={(e) => handleInputChange(e, "password")}
                  autoComplete="new-password"
                />
                <p className="mt-1.5 text-xs font-medium text-gray-500">
                  Must be at least 6 characters and include at least one special character (e.g. @, #, $, !).
                </p>
              </div>

              <div>
                <InputLabel label="Confirm Password" />
                <input
                  type="password"
                  className="form-input-essilor"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange(e, "confirmPassword")}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col md:flex-row justify-end gap-3 pt-12 pb-10">
            <button
              type="button"
              onClick={() => nav.goToAllUsers()}
              className="w-full md:w-56 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3.5 rounded-xl transition-all active:scale-95 text-lg"
            >
              View Users
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canAddUsers}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 text-lg inline-flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              {isSubmitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>

        {createdUser && (
          <section className="mt-10 max-w-4xl mx-auto bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-[#0c244c] mb-2">Created User</h2>
            <p className="text-sm text-gray-500 mb-6">The new account has been saved to the Users table.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <DetailRow label="Access ID" value={createdUser.accessId} />
              <DetailRow label="Username" value={createdUser.username} />
              <DetailRow label="Full Name" value={createdUser.fullName} />
              <DetailRow label="Role" value={createdUser.role} />
              <DetailRow label="Department" value={createdUser.department || "-"} />
              <DetailRow label="Company" value={createdUser.company || "-"} />
              <DetailRow label="User ID" value={String(createdUser.id)} />
            </div>
            <div className="mt-8 flex flex-col md:flex-row gap-3">
              <button
                type="button"
                onClick={() => setCreatedUser(null)}
                className="px-5 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-800"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={() => nav.goToAllUsers()}
                className="px-5 py-3 rounded-xl bg-[#3ea5d9] hover:bg-[#2d8ab8] font-bold text-white"
              >
                Open Users List
              </button>
            </div>
          </section>
        )}
      </main>

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
        }

        .form-input-essilor:focus {
          background-color: #fff;
          border-color: #0084c8;
          box-shadow: 0 0 0 4px rgba(0, 132, 200, 0.1);
        }
      `}</style>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return <label className="block text-xl font-medium text-[#2d3748] mb-3 ml-1">{label}</label>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-gray-400 font-bold">{label}</div>
      <div className="mt-1 font-semibold text-[#0c244c]">{value}</div>
    </div>
  );
}