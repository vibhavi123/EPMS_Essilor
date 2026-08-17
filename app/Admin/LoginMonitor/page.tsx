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
  UserRound,
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
      return "bg-role-super/12 text-role-super ring-1 ring-inset ring-role-super/25";
    case "admin":
      return "bg-role-admin/12 text-role-admin ring-1 ring-inset ring-role-admin/25";
    case "guard":
      return "bg-role-guard/14 text-role-guard ring-1 ring-inset ring-role-guard/25";
    case "employee":
      return "bg-role-employee/12 text-role-employee ring-1 ring-inset ring-role-employee/25";
    default:
      return "bg-secondary text-muted-foreground ring-1 ring-inset ring-border";
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
    const matchesSearch =
      !search ||
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.ipAddress.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase());
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
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <Sidebar />
        <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-rise">
            <div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                Login Monitor
              </h1>

            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden sm:block">
                <DateTime />
              </div>
              <button
                onClick={() => void fetchSessions()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7 animate-rise">
            <div className="surface-card p-5 flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-success/12 text-success flex items-center justify-center shrink-0">
                <Wifi size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-extrabold text-navy">{activeCount}</p>
              </div>
            </div>

            <div className="surface-card p-5 flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                <WifiOff size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ended Sessions</p>
                <p className="text-2xl font-extrabold text-navy">{totalCount - activeCount}</p>
              </div>
            </div>

            <div className="surface-card p-5 flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Logins</p>
                <p className="text-2xl font-extrabold text-navy">{totalCount}</p>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="surface-card p-4 mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-rise">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by username, name, IP, or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <div className="flex gap-1 p-1 bg-secondary/80 rounded-xl border border-border w-full sm:w-auto">
              {(["all", "active", "ended"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                    filterActive === f
                      ? "bg-white text-navy shadow-sm"
                      : "text-muted-foreground hover:text-navy"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions Table Card */}
          <section className="surface-card overflow-hidden mt-6 animate-rise">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-navy">Login Sessions</h2>
              <span className="text-[13px] text-muted-foreground">
                {loading ? "Loading…" : (
                  <>Showing <span className="font-bold text-navy">{paginatedSessions.length}</span> of <span className="font-bold text-navy">{filteredSessions.length}</span> records</>
                )}
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="size-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
                <p className="text-sm font-semibold text-navy">Loading sessions...</p>
              </div>
            ) : paginatedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                  <UserRound className="size-7" />
                </div>
                <h3 className="text-base font-bold text-navy">No sessions found</h3>
                <p className="max-w-sm text-sm text-muted-foreground">No records match the current filter and search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-secondary/70">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Globe size={13} /> IP Address</div>
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Browser / OS</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Clock size={13} /> Login Time</div>
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Logout Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedSessions.map((session) => (
                      <tr
                        key={session.id}
                        className={`transition-colors hover:bg-secondary/50 ${
                          session.isActive ? "bg-success/[0.02]" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          {session.sessionStatus === "active" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/12 text-success ring-1 ring-inset ring-success/25 text-[11px] font-bold">
                              <span className="size-1.5 rounded-full bg-success animate-pulse inline-block" />
                              Active
                            </span>
                          ) : session.sessionStatus === "expired" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-600 ring-1 ring-inset ring-amber-500/25 text-[11px] font-bold">
                              Expired
                            </span>
                          ) : session.sessionStatus === "revoked" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/25 text-[11px] font-bold">
                              <span className="size-1.5 rounded-full bg-destructive inline-block" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border text-[11px] font-bold">
                              Ended
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-gradient-navy text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                              {getInitials(session.fullName, session.username)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-navy">{session.fullName}</p>
                              <p className="text-xs text-muted-foreground font-mono">@{session.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${getRoleBadgeStyle(
                              session.role
                            )}`}
                          >
                            {session.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-semibold text-navy bg-secondary/80 px-2 py-1 rounded-md border border-border">
                            {session.ipAddress}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          <div className="font-medium text-navy">{parseUserAgent(session.userAgent)}</div>
                          <div className="text-xs text-muted-foreground">{parseOS(session.userAgent)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">
                          {formatDateTime(session.loginAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">
                          {session.logoutAt ? (
                            formatDateTime(session.logoutAt)
                          ) : session.sessionStatus === "expired" ? (
                            <span className="text-amber-600 font-semibold text-xs inline-flex items-center gap-1">
                              Session Expired
                              {session.rememberMe && <span className="text-[10px] text-amber-500">(30d)</span>}
                            </span>
                          ) : session.sessionStatus === "active" ? (
                            <span className="text-success font-semibold text-xs inline-flex items-center gap-1">
                              Still Active
                              {session.rememberMe && <span className="text-[10px] text-success/80">(30d)</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="border-t border-border">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsShown={paginatedSessions.length}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              </div>
            )}
          </section>

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

