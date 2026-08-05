"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import GuardBarcodePrintCard from "@/components/GuardBarcodePrintCard";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { fetchNextAccessId } from "@/utils/idSequenceClient";
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
        const canAddGuards = Boolean(data?.data?.permissions?.guardManagementAdd);
        if (!canAddGuards) {
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

  const [guardData, setGuardData] = useState({
    guardName: "",
    guardCompany: "",
    department: "",
  });

  const [generatedAccessId, setGeneratedAccessId] = useState<string | null>(null);
  const [generatedGuard, setGeneratedGuard] = useState<{
    accessId: string;
    guardName: string;
    guardCompany: string;
    department: string;
  } | null>(null);

  const [guards, setGuards] = useState<GuardRecord[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardsError, setGuardsError] = useState("");
  const [guardSearchQuery, setGuardSearchQuery] = useState("");
  const [activeGuardSearch, setActiveGuardSearch] = useState("");
  const [deletingGuardId, setDeletingGuardId] = useState<string | null>(null);
  const [guardToDelete, setGuardToDelete] = useState<GuardRecord | null>(null);
  const [selectedGuardFromList, setSelectedGuardFromList] = useState<GuardRecord | null>(null);
  const [currentGuardPage, setCurrentGuardPage] = useState(1);
  const guardsPerPage = 10;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAccessId = async () => {
    try {
      const newId = await fetchNextAccessId("guard");
      setGeneratedAccessId(newId);
    } catch {
      setGeneratedAccessId(null);
    }
  };

  useEffect(() => {
    void loadAccessId();
  }, []);

  const fetchGuards = async (search = "") => {
    setGuardsLoading(true);
    setGuardsError("");
    setCurrentGuardPage(1);

    try {
      const params = new URLSearchParams({ limit: "500" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/guards?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load guards");
      }

      const guardsList = Array.isArray(data.data) ? data.data : [];
      // Sort by newest first (createdAt descending)
      guardsList.sort((a: GuardRecord, b: GuardRecord) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setGuards(guardsList);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load guards";
      setGuardsError(message);
    } finally {
      setGuardsLoading(false);
    }
  };

  useEffect(() => {
    void fetchGuards();
  }, []);

  const handleGuardSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveGuardSearch(guardSearchQuery.trim());
    await fetchGuards(guardSearchQuery);
  };

  const handleGuardSearchClear = async () => {
    setGuardSearchQuery("");
    setActiveGuardSearch("");
    await fetchGuards("");
  };

  const handleDeleteGuard = async (guard: GuardRecord) => {
    setGuardToDelete(guard);
  };

  const confirmDeleteGuard = async () => {
    if (!guardToDelete) {
      return;
    }

    const guardIdentifier = guardToDelete.id?.toString() || guardToDelete.accessId;

    setDeletingGuardId(guardIdentifier);
    setGuardsError("");

    try {
      const response = await fetch(`/api/guards/${encodeURIComponent(guardIdentifier)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete guard");
      }

      await fetchGuards(activeGuardSearch || guardSearchQuery);

      if (generatedGuard?.accessId === guardToDelete.accessId) {
        setGeneratedGuard(null);
        setSuccess("");
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete guard";
      setGuardsError(message);
    } finally {
      setDeletingGuardId(null);
      setGuardToDelete(null);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof typeof guardData
  ) => {
    setGuardData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!guardData.guardName.trim()) {
      setError("Guard name is required");
      setLoading(false);
      return;
    }
    if (!guardData.guardCompany.trim()) {
      setError("Guard company is required");
      setLoading(false);
      return;
    }
    if (!guardData.department.trim()) {
      setError("Guard department is required");
      setLoading(false);
      return;
    }

    try {
      // Use the auto-generated Access ID (specifically for guards)
      const accessId = generatedAccessId || "";

      // Save guard to database via API
      const response = await fetch("/api/guards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessId,
          guardName: guardData.guardName.trim(),
          guardCompany: guardData.guardCompany.trim(),
          department: guardData.department.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save guard");
      }

      setSuccess("Guard added successfully!");
      setGeneratedGuard({
        accessId,
        guardName: guardData.guardName.trim(),
        guardCompany: guardData.guardCompany.trim(),
        department: guardData.department.trim(),
      });

      await fetchGuards();

      // Reset form
      setGuardData({
        guardName: "",
        guardCompany: "",
        department: "",
      });
      await loadAccessId();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnother = () => {
    setGeneratedGuard(null);
    setSuccess("");
  };

  const renderGuardList = () => {
    // Calculate pagination
    const totalGuards = guards.length;
    const totalPages = Math.ceil(totalGuards / guardsPerPage);
    const startIndex = (currentGuardPage - 1) * guardsPerPage;
    const endIndex = startIndex + guardsPerPage;
    const paginatedGuards = guards.slice(startIndex, endIndex);

    return (
      <section className="mt-10 bg-white p-8 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#0c244c]">All Guards</h2>
            <p className="text-sm text-gray-500 mt-1">
              Search guards by Access ID or name.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {guardsLoading ? "Loading guards..." : `${totalGuards} guards - Page ${currentGuardPage} of ${totalPages || 1}`}
          </div>
        </div>

        <form onSubmit={handleGuardSearch} className="mb-6 flex flex-col md:flex-row gap-3">
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
            onClick={() => void handleGuardSearchClear()}
            disabled={guardsLoading || (!guardSearchQuery && !activeGuardSearch)}
            className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
          >
            Clear
          </button>
        </form>

        {activeGuardSearch && (
          <div className="mb-4 text-sm text-gray-500">
            Search Results
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
          <div className="py-10 text-center text-gray-500">No guards have been created yet.</div>
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
                    onClick={() => setSelectedGuardFromList(guard)}
                    className={`cursor-pointer transition-all ${
                      selectedGuardFromList?.id === guard.id ||
                      selectedGuardFromList?.accessId === guard.accessId
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
                      {guard.guardCompany || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {guard.department || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {guard.createdAt
                        ? new Date(guard.createdAt).toLocaleDateString("en-US")
                        : "-"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteGuard(guard)}
                        disabled={deletingGuardId === (guard.id?.toString() || guard.accessId)}
                        className="px-4 py-2 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
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

        {guards.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, totalGuards)} of {totalGuards} guards
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentGuardPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentGuardPage === 1 || guardsLoading}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentGuardPage(page)}
                    className={`px-3 py-2 rounded-lg font-bold transition-all ${
                      currentGuardPage === page
                        ? "bg-[#3ea5d9] text-white"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentGuardPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentGuardPage === totalPages || guardsLoading}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {selectedGuardFromList && (
          <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-blue-900">{selectedGuardFromList.guardName}</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Access ID: <span className="font-mono font-bold">{selectedGuardFromList.accessId}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedGuardFromList(null)}
                className="p-1 hover:bg-blue-200 rounded-lg transition-all"
              >
                <X size={20} className="text-blue-600" />
              </button>
            </div>

            <GuardBarcodePrintCard
              guard={selectedGuardFromList}
              onAddAnother={() => setSelectedGuardFromList(null)}
            />
          </div>
        )}
      </section>
    );
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
            Add Guard Information
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString("en-US")}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          <section className="bg-white p-8 rounded-lg shadow-md">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Guard Name *
                </label>
                <input
                  type="text"
                  value={guardData.guardName}
                  onChange={(e) => handleChange(e, "guardName")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] focus:border-transparent"
                  placeholder="Enter guard full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Guard Company *
                </label>
                <input
                  type="text"
                  value={guardData.guardCompany}
                  onChange={(e) => handleChange(e, "guardCompany")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Department *
                </label>
                <input
                  type="text"
                  value={guardData.department}
                  onChange={(e) => handleChange(e, "department")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
                  placeholder="Enter department"
                  required
                />
              </div>

              {/* Access ID Field */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Access ID *
                </label>
                <input
                  type="text"
                  value={generatedAccessId || ""}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border-2 border-green-400 rounded-lg text-gray-700 font-mono font-bold text-lg"
                  placeholder="Generated on save"
                />
                {generatedAccessId && (
                  <p className="text-xs text-green-600 mt-2 font-semibold">
                    ✓ Access ID auto-generated
                  </p>
                )}
              </div>

              <div className="flex gap-4 justify-start pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  {loading ? "Submitting..." : "Submit Guard Info"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGuardData({ guardName: "", guardCompany: "", department: "" });
                    setError("");
                  }}
                  disabled={loading}
                  className="px-8 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          {success && generatedGuard && (
            <div className="mt-10 bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
              <p className="text-green-700 font-bold mb-6">{success}</p>
              <GuardBarcodePrintCard
                guard={generatedGuard}
                onAddAnother={handleAddAnother}
              />
            </div>
          )}

          {renderGuardList()}
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
          onConfirm={() => void confirmDeleteGuard()}
          isSubmitting={deletingGuardId !== null}
        />
      </main>
    </div>
  );
}
