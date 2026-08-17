"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import { Info, Save, RotateCcw, Timer, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

export default function OverdueSettingsPage() {
  const nav = useNavigation();
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAllUsers();
          return;
        }
        const canAccessOverdue = Boolean(data?.data?.permissions?.overdueEmployeeAlert) || Boolean(data?.data?.permissions?.accessManagementControl);
        if (!canAccessOverdue) {
          nav.goToAllUsers();
          return;
        }
        setHasPermission(true);
      } catch {
        nav.goToAllUsers();
      } finally {
        setIsCheckingPermissions(false);
      }
    }
    void checkPermissions();
  }, [nav]);

  useEffect(() => {
    if (!hasPermission) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/overdue");
        const data = await res.json();
        if (data?.success) setValue(String(data.value ?? ""));
      } catch {
        // ignore
      }
    })();
  }, [hasPermission]);

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

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/overdue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Saved");
      } else {
        setMessage(data.message || "Failed to save");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        {/* Page header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Overdue Alert Settings</h1>
          </div>
        </div>

        <div className="mt-7 max-w-2xl space-y-5">

          {/* Success/error banner */}
          {message && (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium animate-rise ${
              message === 'Saved'
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}>
              {message === 'Saved'
                ? <CheckCircle2 className="size-5 shrink-0" />
                : <AlertTriangle className="size-5 shrink-0" />}
              <span className="flex-1">{message === 'Saved' ? 'Settings saved successfully.' : message}</span>
              <button onClick={() => setMessage(null)} className="opacity-60 transition-opacity hover:opacity-100">
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Settings card */}
          <div className="surface-card space-y-5 p-6 animate-rise">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-white">
                <Timer className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-navy">Overdue Hours Threshold</h2>
                <p className="text-[13px] text-muted-foreground">Minimum 1 hour. Applies to all employees immediately after saving.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Overdue Hours</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-11 max-w-40 rounded-lg border border-border bg-card px-3 font-mono text-base font-bold text-navy transition-all hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
                <span className="text-sm font-medium text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-5">
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
              >
                {loading ? <> Save Settings...</> : <> Save Settings</>}
              </button>
              <button
                onClick={() => setValue('')}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none"
              >
                <RotateCcw className="size-4" /> Reset
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
