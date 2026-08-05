"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { createPackageDescription } from "@/lib/api/packageDescriptions";
import { PackageDescription } from "@/utils/formTypes";

type PackageDescriptionListItem = {
  id: number;
  packageDescription: string;
  createdAt?: string;
};

export default function AddPackagePage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  const [packageData, setPackageData] = useState({
    packageDescription: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdDescription, setCreatedDescription] = useState<PackageDescription | null>(null);
  const [packageDescriptions, setPackageDescriptions] = useState<PackageDescriptionListItem[]>([]);
  const [packageDescriptionsLoading, setPackageDescriptionsLoading] = useState(false);
  const [packageDescriptionsError, setPackageDescriptionsError] = useState("");
  const [packageDescriptionSearchQuery, setPackageDescriptionSearchQuery] = useState("");
  const [activePackageDescriptionSearch, setActivePackageDescriptionSearch] = useState("");
  const [deletingPackageDescriptionId, setDeletingPackageDescriptionId] = useState<number | null>(null);
  const [packageDescriptionToDelete, setPackageDescriptionToDelete] = useState<PackageDescriptionListItem | null>(null);
  const [currentPackageDescriptionPage, setCurrentPackageDescriptionPage] = useState(1);
  const packageDescriptionsPerPage = 10;

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAddPackage();
          return;
        }

        const canAccessDescriptionSection = Boolean(data?.data?.permissions?.addPackageDescription);
        if (!canAccessDescriptionSection) {
          nav.goToAddPackage();
          return;
        }

        setHasPermission(true);
      } catch {
        nav.goToAddPackage();
      } finally {
        setIsCheckingPermissions(false);
      }
    }

    void checkPermissions();
  }, [nav]);

  const fetchPackageDescriptions = async (search = "") => {
    setPackageDescriptionsLoading(true);
    setPackageDescriptionsError("");
    setCurrentPackageDescriptionPage(1);

    try {
      const params = new URLSearchParams({ limit: "500" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/package-descriptions?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load package descriptions");
      }

      const descriptionsList = Array.isArray(data.data) ? data.data : [];
      // Sort by newest first (createdAt descending)
      descriptionsList.sort((a: PackageDescriptionListItem, b: PackageDescriptionListItem) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setPackageDescriptions(descriptionsList);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load package descriptions";
      setPackageDescriptionsError(message);
    } finally {
      setPackageDescriptionsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPackageDescriptions();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPackageData((prev) => ({ ...prev, packageDescription: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const trimmedName = packageData.packageDescription.trim();

    if (!trimmedName) {
      setError("Please enter package description");
      setLoading(false);
      return;
    }

    // Check if package description already exists in the list
    const existingDescription = packageDescriptions.find(
      (p) => p.packageDescription.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingDescription) {
      setError(`Package description "${trimmedName}" already exists in the system`);
      setLoading(false);
      return;
    }

    try {
      const newDescription = await createPackageDescription(trimmedName);
      setSuccess(true);
      setCreatedDescription(newDescription);
      setPackageData({
        packageDescription: "",
      });
      // Refresh the package descriptions list to show the newly created description
      await fetchPackageDescriptions(activePackageDescriptionSearch || packageDescriptionSearchQuery);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedDescription(null);
  };

  const handlePackageDescriptionSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivePackageDescriptionSearch(packageDescriptionSearchQuery.trim());
    await fetchPackageDescriptions(packageDescriptionSearchQuery);
  };

  const handlePackageDescriptionSearchClear = async () => {
    setPackageDescriptionSearchQuery("");
    setActivePackageDescriptionSearch("");
    await fetchPackageDescriptions("");
  };

  const handleDeletePackageDescription = async (description: PackageDescriptionListItem) => {
    setPackageDescriptionToDelete(description);
  };

  const confirmDeletePackageDescription = async () => {
    if (!packageDescriptionToDelete) {
      return;
    }

    setDeletingPackageDescriptionId(packageDescriptionToDelete.id);
    setPackageDescriptionsError("");

    try {
      const response = await fetch(`/api/package-descriptions/${packageDescriptionToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete package description");
      }

      await fetchPackageDescriptions(activePackageDescriptionSearch || packageDescriptionSearchQuery);

      if (createdDescription?.id === packageDescriptionToDelete.id) {
        setCreatedDescription(null);
        setSuccess(false);
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete package description";
      setPackageDescriptionsError(message);
    } finally {
      setDeletingPackageDescriptionId(null);
      setPackageDescriptionToDelete(null);
    }
  };

  const renderPackageDescriptionList = () => (
    <section className="mt-10 bg-white p-8 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0c244c]">All Package Descriptions</h2>
          <p className="text-sm text-gray-500 mt-1">Search package descriptions by text.</p>
        </div>
        <div className="text-sm text-gray-500">
          {packageDescriptionsLoading ? "Loading descriptions..." : `${packageDescriptions.length} descriptions`}
        </div>
      </div>

      <form onSubmit={handlePackageDescriptionSearch} className="mb-6 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={packageDescriptionSearchQuery}
          onChange={(e) => setPackageDescriptionSearchQuery(e.target.value)}
          placeholder="Search by package description"
          className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
        />
        <button
          type="submit"
          disabled={packageDescriptionsLoading}
          className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void handlePackageDescriptionSearchClear()}
          disabled={packageDescriptionsLoading || (!packageDescriptionSearchQuery && !activePackageDescriptionSearch)}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Clear
        </button>
      </form>

      {activePackageDescriptionSearch && (
        <div className="mb-4 text-sm text-gray-500">
          Showing results for <span className="font-semibold text-[#0c244c]">{activePackageDescriptionSearch}</span>
        </div>
      )}

      {packageDescriptionsError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
          <p className="text-red-700 font-medium">{packageDescriptionsError}</p>
        </div>
      )}

      {packageDescriptionsLoading ? (
        <div className="py-10 text-center text-gray-500">Loading package description records...</div>
      ) : packageDescriptions.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No package descriptions have been created yet.</div>
      ) : (
        <>
          {(() => {
            const totalDescriptions = packageDescriptions.length;
            const totalPages = Math.ceil(totalDescriptions / packageDescriptionsPerPage);
            const startIndex = (currentPackageDescriptionPage - 1) * packageDescriptionsPerPage;
            const endIndex = startIndex + packageDescriptionsPerPage;
            const paginatedDescriptions = packageDescriptions.slice(startIndex, endIndex);

            return (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Description ID</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedDescriptions.map((description) => (
                <tr key={description.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-mono text-sm font-semibold text-[#0c244c]">
                    {description.id}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">
                    {description.packageDescription}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {description.createdAt ? new Date(description.createdAt).toLocaleDateString("en-US") : "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeletePackageDescription(description)}
                      disabled={deletingPackageDescriptionId === description.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                    >
                      {deletingPackageDescriptionId === description.id ? "Removing..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
                    </tbody>
                  </table>
                </div>

                {totalDescriptions > 0 && totalPages > 1 && (
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, totalDescriptions)} of {totalDescriptions} descriptions
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPackageDescriptionPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPackageDescriptionPage === 1 || packageDescriptionsLoading}
                        className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPackageDescriptionPage(page)}
                            className={`px-3 py-2 rounded-lg font-bold transition-all ${
                              currentPackageDescriptionPage === page
                                ? "bg-[#3ea5d9] text-white"
                                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPackageDescriptionPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPackageDescriptionPage === totalPages || packageDescriptionsLoading}
                        className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </section>
  );

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
            Add Package Description
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('en-US')}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          {success && createdDescription ? (
            <section className="bg-white p-8 rounded-lg shadow-md">
              <div className="text-center">
                <div className="mb-6">
                  <div className="inline-block p-4 bg-green-100 rounded-full">
                    <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">Success</h2>
                <p className="text-gray-600 mb-4">
                  Package description has been added successfully!
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  <strong>Description:</strong> {createdDescription.packageDescription}
                </p>
              </div>

              <div className="flex gap-4 justify-center pt-6 border-t border-gray-200">
                <button
                  onClick={handleCreateAnother}
                  className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  Add Another Description
                </button>

                <button
                  onClick={() => {
                    nav.goToAddPackage();
                  }}
                  className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
                >
                  Back to Add Package
                </button>
              </div>
            </section>
          ) : (
            <section className="bg-white p-8 rounded-lg shadow-md">
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Package Description *
                  </label>
                  <textarea
                    rows={8}
                    value={packageData.packageDescription}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] resize-y"
                    placeholder="Describe the package (e.g., documents, electronics, fragile items, weight, dimensions, etc.)"
                  />
                </div>

                <div className="flex gap-4 justify-start pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                  >
                    {loading ? "Submitting..." : "Submit Package Info"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      nav.goToAddPackage();
                    }}
                    disabled={loading}
                    className="px-8 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {renderPackageDescriptionList()}
        </div>

        <DeleteConfirmModal
          isOpen={packageDescriptionToDelete !== null}
          title="Remove Package Description"
          message={
            packageDescriptionToDelete
              ? `Remove this package description from the list?`
              : "Remove this package description from the list?"
          }
          confirmText="Remove"
          onCancel={() => setPackageDescriptionToDelete(null)}
          onConfirm={() => void confirmDeletePackageDescription()}
          isSubmitting={deletingPackageDescriptionId !== null}
        />
      </main>
    </div>
  );
}