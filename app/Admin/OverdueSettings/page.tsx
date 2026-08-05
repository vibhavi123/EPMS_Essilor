"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";

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
      <div className="flex h-screen bg-[#f8f9fc]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Checking permissions...</p>
        </div>
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
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        <div className="p-6 bg-white rounded-2xl shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Overdue Settings</h1>
          <div className="space-y-3 max-w-sm">
            <label className="block text-sm font-bold text-gray-700">Overdue Hours</label>
            <input
              type="number"
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {loading ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setValue("")} className="px-4 py-2 bg-gray-200 rounded-lg">Reset</button>
            </div>
            {message && <p className="text-sm text-gray-600">{message}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
