"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import GuardBarcodePrintCard from "@/components/GuardBarcodePrintCard";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { X } from "lucide-react";

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

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
            Guards &amp; Barcodes
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString("en-US")}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">

          {/* Guards List */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0c244c]">All Guards</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Click a row to view and print the guard&apos;s barcode.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {guardsLoading
                  ? "Loading guards..."
                  : `${guards.length} guards · Page ${currentPage} of ${totalPages || 1}`}
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="mb-6 flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={guardSearchQuery}
                onChange={(e) => setGuardSearchQuery(e.target.value)}
                placeholder="Search by Access ID or name"
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
              />
              <button
                type="submit"
                disabled={guardsLoading}
                className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={guardsLoading || (!guardSearchQuery && !activeGuardSearch)}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
              >
                Clear
              </button>
            </form>

            {activeGuardSearch && (
              <div className="mb-4 text-sm text-gray-500">
                Results for &quot;<span className="font-semibold">{activeGuardSearch}</span>&quot;
              </div>
            )}

            {guardsError && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 font-medium">{guardsError}</p>
              </div>
            )}

            {guardsLoading ? (
              <div className="py-10 text-center text-gray-500">Loading guard records...</div>
            ) : guards.length === 0 ? (
              <div className="py-10 text-center text-gray-500">No guards found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Access ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedGuards.map((guard) => (
                      <tr
                        key={guard.id ?? guard.accessId}
                        onClick={() => setSelectedGuard(guard)}
                        className={`cursor-pointer transition-all ${
                          selectedGuard?.accessId === guard.accessId
                            ? "bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-4 font-mono text-sm font-semibold text-[#0c244c]">
                          {guard.accessId}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-800">
                          {guard.guardName}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {guard.guardCompany || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {guard.department || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {guard.createdAt
                            ? new Date(guard.createdAt).toLocaleDateString("en-US")
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(guard); }}
                            disabled={deletingGuardId === (guard.id?.toString() || guard.accessId)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                          >
                            {deletingGuardId === (guard.id?.toString() || guard.accessId)
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}–{Math.min(startIndex + guardsPerPage, guards.length)} of {guards.length} guards
                </div>
                <div className="flex gap-2 items-center flex-wrap justify-center">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1 || guardsLoading}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
                  >
                    Previous
                  </button>
                  {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                    typeof page === "number" ? (
                      <button
                        key={`page-${page}`}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                          currentPage === page
                            ? "bg-[#3ea5d9] text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-500 font-bold text-sm">
                        {page}
                      </span>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages || guardsLoading}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Barcode card for selected guard */}
            {selectedGuard && (
              <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">{selectedGuard.guardName}</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Access ID: <span className="font-mono font-bold">{selectedGuard.accessId}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedGuard(null)}
                    className="p-1 hover:bg-blue-200 rounded-lg transition-all"
                  >
                    <X size={20} className="text-blue-600" />
                  </button>
                </div>
                <GuardBarcodePrintCard
                  guard={selectedGuard}
                  onAddAnother={() => setSelectedGuard(null)}
                />
              </div>
            )}
          </section>
        </div>

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
