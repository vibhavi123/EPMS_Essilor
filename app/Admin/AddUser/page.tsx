"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AlertModal from "@/components/AlertModal";
import { ChevronDown, UserPlus, Copy, Check, RotateCcw, ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
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

  if (!canAddUsers) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Access Control</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Add New User</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => nav.goToAllUsers()} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent">
              <ArrowLeft className="size-4" /> Back to Users List
            </button>
          </div>
        </div>

        {createdUser ? (
          <div className="surface-card overflow-hidden animate-rise mt-7 w-full">
            <div className="flex items-center gap-4 border-b border-border bg-success/8 px-6 py-6">
              <div>
                <h2 className="text-xl font-extrabold text-navy">User Created Successfully</h2>
              </div>
            </div>
            <div className="space-y-4 p-6 sm:p-8">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Access ID</label>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 flex-1 items-center rounded-lg border border-dashed border-primary/40 bg-primary/6 px-3 font-mono text-sm font-bold tracking-wide text-navy">
                    {createdUser.accessId}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdUser.accessId);
                      setCopiedAccessId(true);
                      setTimeout(() => setCopiedAccessId(false), 2000);
                    }}
                    className="grid size-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-primary active:scale-95"
                    aria-label="Copy access ID"
                  >
                    {copiedAccessId ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>
              <dl className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2">
                {[
                  ['Username', createdUser?.username], 
                  ['Full Name', createdUser?.fullName], 
                  ['Department', createdUser?.department ?? '-'], 
                  ['Company', createdUser?.company ?? '-']
                ].map(([k, v]) => (
                  <div key={k} className="bg-card px-4 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => { setCreatedUser(null); resetForm(); void loadAccessId("guard"); }} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110">
                  <UserPlus className="size-4" /> Add Another User
                </button>
                <button type="button" onClick={() => nav.goToAllUsers()} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97]">
                  View Users List
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6 sm:p-8 animate-rise mt-7 w-full">
            {alertModal.isOpen && alertModal.type === 'error' && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive animate-rise mb-4">
                <AlertTriangle className="size-5 shrink-0" />
                <span className="flex-1">{alertModal.message}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Access ID</label>
              <div className="flex items-center gap-2">
                <div className="flex h-11 flex-1 items-center rounded-lg border border-dashed border-primary/40 bg-primary/6 px-3 font-mono text-sm font-bold tracking-wide text-navy">
                  {formData.accessId}
                </div>
                <button
                  type="button"
                  onClick={copyAccessIdToClipboard}
                  className="grid size-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-primary active:scale-95"
                  aria-label="Copy access ID"
                >
                  {copiedAccessId ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Username *</label>
                <input
                  type="text"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.username}
                  onChange={(e) => handleInputChange(e, "username")}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Full Name *</label>
                <input
                  type="text"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange(e, "fullName")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Role *</label>
                <div className="relative">
                  <select
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-navy transition-all hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer pr-10"
                    value={formData.role}
                    onChange={(e) => handleInputChange(e, "role")}
                  >
                    <option value="Employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="guard">Guard</option>
                    <option value="superAdmin">Super Admin</option>
                  </select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-4"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Department</label>
                <input
                  type="text"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.department}
                  onChange={(e) => handleInputChange(e, "department")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Company</label>
                <input
                  type="text"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.company}
                  onChange={(e) => handleInputChange(e, "company")}
                />
              </div>
              <div className="hidden sm:block"></div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Password *</label>
                <input
                  type="password"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.password}
                  onChange={(e) => handleInputChange(e, "password")}
                  autoComplete="new-password"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Min 6 chars, 1 special char (@, #, $, !).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Confirm Password *</label>
                <input
                  type="password"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange(e, "confirmPassword")}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-5 mt-2">
              <button type="submit" disabled={isSubmitting || !canAddUsers} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 disabled:pointer-events-none disabled:opacity-45">
                {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : <><UserPlus className="size-4" /> Create User</>}
              </button>
              <button type="button" onClick={resetForm} disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none">
                <RotateCcw className="size-4" /> Reset Form
              </button>
            </div>
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
    </div>
  );
}