"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import type { UserPermissionsResponse } from "@/app/api/permissions/me/route";

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/permissions/me");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch permissions");
        }

        setPermissions(data.data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Failed to fetch permissions:", errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPermissions();
  }, []);

  const hasPermission = useCallback(
    (permission: keyof UserPermissionsResponse): boolean => {
      if (!permissions) return false;
      return Boolean(permissions[permission]);
    },
    [permissions]
  );

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
  };
}

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: keyof UserPermissionsResponse;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all flex items-center justify-center">
          <div className="text-gray-600">Loading permissions...</div>
        </main>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      fallback || (
        <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
          <Sidebar />
          <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all flex items-center justify-center">
            <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
              <p className="text-lg font-semibold text-red-700">Access Denied</p>
              <p className="text-sm text-red-600 mt-2">You do not have permission to access this page.</p>
            </div>
          </main>
        </div>
      )
    );
  }

  return children;
}
