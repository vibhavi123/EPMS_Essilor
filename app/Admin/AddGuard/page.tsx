"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import GuardBarcodePrintCard from "@/components/GuardBarcodePrintCard";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { X, Search, Trash2, ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

type GuardRecord = {
  id?: number;
  accessId: string;
  guardName: string;
  guardCompany: string | null;
  department: string | null;
  createdAt?: string;
};

export default function AddGuardPage() {
  const nav = useNavigation();
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
        const canViewGuards =
          Boolean(data?.data?.permissions?.guardManagementAdd) ||
          Boolean(data?.data?.permissions?.guardManagementView);
        if (!canViewGuards) {
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

  const [guards, setGuards] = useState<GuardRecord[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardsError, setGuardsError] = useState("");
  const [guardSearchQuery, setGuardSearchQuery] = useState("");
  const [activeGuardSearch, setActiveGuardSearch] = useState("");
  const [deletingGuardId, setDeletingGuardId] = useState<string | null>(null);
  const [guardToDelete, setGuardToDelete] = useState<GuardRecord | null>(null);
  const [selectedGuard, setSelectedGuard] = useState<GuardRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const guardsPerPage = 10;

  const fetchGuards = async (search = "") => {
    setGuardsLoading(true);
    setGuardsError("");
    setCurrentPage(1);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/guards?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load guards");
      const list: GuardRecord[] = Array.isArray(data.data) ? data.data : [];
      list.sort((a, b) => {
        const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dB - dA;
      });
      setGuards(list);
    } catch (err) {
      setGuardsError(err instanceof Error ? err.message : "Unable to load guards");
    } finally {
      setGuardsLoading(false);
    }
  };

  useEffect(() => { void fetchGuards(); }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveGuardSearch(guardSearchQuery.trim());
    await fetchGuards(guardSearchQuery);
  };

  const handleClear = async () => {
    setGuardSearchQuery("");
    setActiveGuardSearch("");
    await fetchGuards("");
  };

  const handleDelete = (guard: GuardRecord) => setGuardToDelete(guard);

  const confirmDelete = async () => {
    if (!guardToDelete) return;
    const id = guardToDelete.id?.toString() || guardToDelete.accessId;
    setDeletingGuardId(id);
    setGuardsError("");
    try {
      const res = await fetch(`/api/guards/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete guard");
      if (selectedGuard?.accessId === guardToDelete.accessId) setSelectedGuard(null);
      await fetchGuards(activeGuardSearch || guardSearchQuery);
    } catch (err) {
      setGuardsError(err instanceof Error ? err.message : "Unable to delete guard");
    } finally {
      setDeletingGuardId(null);
      setGuardToDelete(null);
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(guards.length / guardsPerPage);
  const startIndex = (currentPage - 1) * guardsPerPage;
  const paginatedGuards = guards.slice(startIndex, startIndex + guardsPerPage);

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) if (!pages.includes(i)) pages.push(i);
    if (current < total - 2) pages.push("...");
    if (!pages.includes(total)) pages.push(total);
    return pages;
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

  if (!hasPermission) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-rise">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
              Guards &amp; Barcodes
            </h1>

          </div>
          <div>
            <button 
              onClick={() => nav.goToAllUsers()} 
              className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] transition-all"
            >
              <ArrowLeft className="size-4" /> Back to Users
            </button>
          </div>
        </div>

        {/* Selected Guard Barcode Print Card */}
        {selectedGuard && (
          <div className="mt-7 surface-card p-6 animate-rise border-l-4 border-l-primary shadow-lift">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Selected Guard</p>
                <h3 className="text-lg font-extrabold text-navy">{selectedGuard.guardName}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Access ID: <span className="font-bold text-navy">{selectedGuard.accessId}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedGuard(null)} 
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-navy transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <GuardBarcodePrintCard
              guard={selectedGuard}
              onAddAnother={() => setSelectedGuard(null)}
            />
          </div>
        )}

        {/* Guards Directory Table Card */}
        <section className="surface-card overflow-hidden animate-rise mt-7">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleSearch} className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={guardSearchQuery}
                onChange={(e) => setGuardSearchQuery(e.target.value)}
                placeholder="Search by Access ID or name"
                className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
            </form>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={guardsLoading}
                className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97] disabled:opacity-45"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={guardsLoading || (!guardSearchQuery && !activeGuardSearch)}
                className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45"
              >
                <X className="size-4" /> Clear
              </button>
            </div>
          </div>

          {activeGuardSearch && (
            <div className="px-5 py-2.5 bg-secondary/40 border-b border-border text-xs text-muted-foreground">
              Results for &quot;<span className="font-semibold text-navy">{activeGuardSearch}</span>&quot;
            </div>
          )}

          {guardsError && (
            <div className="p-4 border-b border-border bg-destructive/5 text-sm text-destructive font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{guardsError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-secondary/70">
                  <th className="w-36 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Access ID</th>
                  <th className="w-auto px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="w-40 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Company</th>
                  <th className="w-40 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                  <th className="w-36 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="w-20 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedGuards.map((guard) => (
                  <tr
                    key={guard.id ?? guard.accessId}
                    onClick={() => setSelectedGuard(guard)}
                    className={`cursor-pointer transition-colors ${
                      selectedGuard?.accessId === guard.accessId
                        ? "bg-primary/8"
                        : "hover:bg-secondary/60"
                    }`}
                  >
                    <td className="relative px-5 py-3.5 font-mono text-[13px] font-semibold text-navy">
                      {selectedGuard?.accessId === guard.accessId && (
                        <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary" />
                      )}
                      {guard.accessId}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-navy break-words break-all">
                      {guard.guardName}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {guard.guardCompany || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {guard.department || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">
                      {guard.createdAt
                        ? new Date(guard.createdAt).toLocaleDateString("en-US")
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(guard);
                        }}
                        disabled={deletingGuardId === (guard.id?.toString() || guard.accessId)}
                        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingGuardId === (guard.id?.toString() || guard.accessId) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {guardsLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Loading guard records...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!guardsLoading && guards.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No guards found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {guards.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-3 flex-wrap gap-3">
              <p className="text-[13px] text-muted-foreground">
                Showing <span className="font-medium text-navy">{startIndex + 1}</span> to <span className="font-medium text-navy">{Math.min(startIndex + guardsPerPage, guards.length)}</span> of <span className="font-medium text-navy">{guards.length}</span> guards
              </p>
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1 || guardsLoading}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  Prev
                </button>
                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  typeof page === "number" ? (
                    <button
                      key={`page-${page}`}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-semibold transition-all ${
                        currentPage === page
                          ? "bg-gradient-brand text-white shadow-sm"
                          : "border border-border bg-card text-navy hover:bg-accent"
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={`ellipsis-${idx}`} className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground text-xs font-bold">
                      {page}
                    </span>
                  )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages || guardsLoading}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <DeleteConfirmModal
          isOpen={guardToDelete !== null}
          title="Remove Guard"
          message={
            guardToDelete
              ? `Remove ${guardToDelete.guardName} (${guardToDelete.accessId}) from the guard list?`
              : "Remove this guard from the list?"
          }
          confirmText="Remove"
          onCancel={() => setGuardToDelete(null)}
          onConfirm={() => void confirmDelete()}
          isSubmitting={deletingGuardId !== null}
        />
      </main>
    </div>
  );
}

