"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import Pagination, { usePagination } from "@/components/Pagination";
import { PermissionGuard } from "@/hooks/usePermissions";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Shield,
  Globe,
  Clock,
  Search,
  Timer,
} from "lucide-react";

interface LoginSession {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  role: string;
  ipAddress: string;
  userAgent: string | null;
  loginAt: string | null;
  logoutAt: string | null;
  isActive: boolean;
  sessionStatus: "active" | "expired" | "logged_out" | "revoked";
  rememberMe?: boolean;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  return ua.substring(0, 40) + (ua.length > 40 ? "…" : "");
}

function parseOS(ua: string | null): string {
  if (!ua) return "";
  if (ua.includes("Windows NT 10")) return "Windows 10/11";
  if (ua.includes("Windows NT 6.1")) return "Windows 7";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "";
}

function getInitials(name?: string, username?: string) {
  const target = name?.trim() || username?.trim() || "U";
  const parts = target.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return target.substring(0, 2).toUpperCase();
}

function getRoleBadgeStyle(role?: string) {
  switch (role?.toLowerCase()) {
    case "superadmin":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "admin":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "guard":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "employee":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function LoginMonitorPage() {
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "ended">("all");
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login-monitor");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load sessions");
      setSessions(json.data ?? []);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: err instanceof Error ? err.message : "Failed to load sessions",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const filteredSessions = sessions.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (s.username ?? "").toLowerCase().includes(q) ||
      (s.fullName ?? "").toLowerCase().includes(q) ||
      (s.ipAddress ?? "").toLowerCase().includes(q) ||
      (s.role ?? "").toLowerCase().includes(q);
    const matchesFilter =
      filterActive === "all" ||
      (filterActive === "active" && s.isActive) ||
      (filterActive === "ended" && !s.isActive);
    return matchesSearch && matchesFilter;
  });

  const {
    currentPage,
    setCurrentPage,
    paginatedItems: paginatedSessions,
    totalPages,
    totalItems,
  } = usePagination({
    items: filteredSessions,
    itemsPerPage: 10,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterActive, setCurrentPage]);

  const activeCount = sessions.filter((s) => s.isActive).length;
  const totalCount = sessions.length;

  return (
    <PermissionGuard permission="loginMonitor">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />
        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
          {/* Header */}
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c] flex items-center gap-3">
                Login Monitor
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track active sessions, IP addresses, and user activity in real time.
              </p>
            </div>
            <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
              <div className="hidden md:block">
                <DateTime />
              </div>
              <button
                onClick={() => void fetchSessions()}
                disabled={loading}
                className="flex items-center gap-2 bg-[#0084c8] hover:bg-[#0071ad] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </header>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <Wifi className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active Sessions</p>
                <p className="text-3xl font-black text-green-600">{activeCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <WifiOff className="text-gray-400" size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Ended Sessions</p>
                <p className="text-3xl font-black text-gray-600">{totalCount - activeCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Shield className="text-[#0084c8]" size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Logins</p>
                <p className="text-3xl font-black text-[#0c244c]">{totalCount}</p>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative flex-1 w-full sm:max-w-md">
              <input
                type="text"
                placeholder="Search by username, name, IP, or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0084c8] text-sm transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {(["all", "active", "ended"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                    filterActive === f
                      ? "bg-[#0c244c] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0c244c]">Login Sessions</h2>
              <span className="text-sm font-medium text-gray-500">
                {loading ? "Loading…" : `Showing ${paginatedSessions.length} of ${filteredSessions.length} records`}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0084c8]" />
              </div>
            ) : paginatedSessions.length === 0 ? (
              <div className="py-16 text-center text-gray-400 font-medium">
                No sessions found matching your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">User</th>
                      <th className="px-6 py-3.5">Role</th>
                      <th className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5"><Globe size={14} /> IP Address</div>
                      </th>
                      <th className="px-6 py-3.5">Browser / OS</th>
                      <th className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5"><Clock size={14} /> Login Time</div>
                      </th>
                      <th className="px-6 py-3.5">Logout Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedSessions.map((session) => (
                      <tr
                        key={session.id}
                        className={`transition-colors ${
                          session.isActive ? "hover:bg-green-50/20" : "hover:bg-gray-50/80 opacity-80"
                        }`}
                      >
                        <td className="px-6 py-4">
                          {session.sessionStatus === "active" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                              Active
                            </span>
                          ) : session.sessionStatus === "expired" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">
                              Expired
                            </span>
                          ) : session.sessionStatus === "revoked" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                              Ended
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#0084c8] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                              {getInitials(session.fullName, session.username)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-[#0c244c]">{session.fullName}</p>
                              <p className="text-xs text-gray-400">@{session.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleBadgeStyle(
                              session.role
                            )}`}
                          >
                            {session.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                            {session.ipAddress}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="font-medium text-gray-800">{parseUserAgent(session.userAgent)}</div>
                          <div className="text-xs text-gray-400">{parseOS(session.userAgent)}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatDateTime(session.loginAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {session.logoutAt ? (
                            formatDateTime(session.logoutAt)
                          ) : session.sessionStatus === "expired" ? (
                            <span className="text-orange-500 font-bold text-xs bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200 inline-flex items-center gap-1">
                               Session Expired
                              {session.rememberMe && <span className="ml-1 text-[10px] text-orange-400">(30d)</span>}
                            </span>
                          ) : session.sessionStatus === "active" ? (
                            <span className="text-green-600 font-bold text-xs bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                              Still Active
                              {session.rememberMe && <span className="ml-1 text-[10px] text-green-500">(30d)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsShown={paginatedSessions.length}
              onPageChange={(page) => setCurrentPage(page)}
            />
          )}

          <AlertModal
            isOpen={alertModal.isOpen}
            onClose={() => setAlertModal((m) => ({ ...m, isOpen: false }))}
            title={alertModal.title}
            message={alertModal.message}
            type={alertModal.type}
          />
        </main>
      </div>
    </PermissionGuard>
  );
}
