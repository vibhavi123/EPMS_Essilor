"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { createPackageDescription } from "@/lib/api/packageDescriptions";
import { PackageDescription } from "@/utils/formTypes";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Plus, Search, X, Trash2 } from "lucide-react";

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
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        {(() => {
                          const getPageNumbers = (current: number, total: number) => {
                            if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
                            const pages: (number | string)[] = [1];
                            if (current > 3) pages.push("...");
                            const start = Math.max(2, current - 1);
                            const end = Math.min(total - 1, current + 1);
                            for (let i = start; i <= end; i++) {
                              if (!pages.includes(i)) pages.push(i);
                            }
                            if (current < total - 2) pages.push("...");
                            if (!pages.includes(total)) pages.push(total);
                            return pages;
                          };
                          return getPageNumbers(currentPackageDescriptionPage, totalPages).map((page, index) =>
                            typeof page === "number" ? (
                              <button
                                key={`page-${page}`}
                                onClick={() => setCurrentPackageDescriptionPage(page)}
                                className={`px-3 py-2 rounded-lg font-bold transition-all text-sm ${
                                  currentPackageDescriptionPage === page
                                    ? "bg-[#3ea5d9] text-white"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                              >
                                {page}
                              </button>
                            ) : (
                              <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500 font-bold text-sm">
                                {page}
                              </span>
                            )
                          );
                        })()}
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

  const totalPages = Math.ceil(packageDescriptions.length / packageDescriptionsPerPage);
  const startIndex = (currentPackageDescriptionPage - 1) * packageDescriptionsPerPage;
  const endIndex = startIndex + packageDescriptionsPerPage;
  const paged = packageDescriptions.slice(startIndex, endIndex);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Package Description Management</h1>
          </div>
          <div>
            <button onClick={() => nav.goToAddPackage()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] transition-all">
              <ArrowLeft className="size-4" /> Back to Hub
            </button>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-6 w-full">
          <section className="surface-card p-6 animate-rise">
            <h2 className="text-base font-bold text-navy">Add Package Description</h2>
            {success && createdDescription && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success animate-rise">
                  <span>Added successfully.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleCreateAnother} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97]">
                    <Plus className="size-4" /> Add Another
                  </button>
                  <button onClick={() => nav.goToAddPackage()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97]">
                    <ArrowLeft className="size-4" /> Back to Hub
                  </button>
                </div>
              </div>
            )}
            {!success && (
              <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Package Description</label>
                  <textarea value={packageData.packageDescription} onChange={handleChange} rows={4} className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
                  {error && <p className="flex items-center gap-1 text-[12px] font-medium text-destructive animate-rise"><AlertTriangle className="size-3.5" /> {error}</p>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-6 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none">
                    {loading ? <><Loader2 className="size-4 animate-spin" /> Adding...</> : 'Add Description'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="surface-card overflow-hidden animate-rise">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={packageDescriptionSearchQuery} onChange={(e) => setPackageDescriptionSearchQuery(e.target.value)} placeholder="Search..." className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
              </div>
              <div className="flex gap-2">
                <button onClick={handlePackageDescriptionSearch} disabled={packageDescriptionsLoading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-gradient-brand text-white active:scale-[0.97] disabled:opacity-45">Search</button>
                <button onClick={() => void handlePackageDescriptionSearchClear()} disabled={packageDescriptionsLoading || (!packageDescriptionSearchQuery && !activePackageDescriptionSearch)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45"><X className="size-4" /> Clear</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-secondary/70">
                    <th className="w-auto px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="w-36 sm:w-44 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created Date</th>
                    <th className="w-20 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map(item => (
                    <tr key={item.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-5 py-3.5 text-sm font-semibold text-navy break-words break-all whitespace-pre-wrap">{item.packageDescription}</td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US") : "-"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => void handleDeletePackageDescription(item)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95" aria-label="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {packageDescriptionsLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</td>
                    </tr>
                  )}
                  {!packageDescriptionsLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {packageDescriptions.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-3">
                <p className="text-[13px] text-muted-foreground">
                  Showing <span className="font-medium text-navy">{startIndex + 1}</span> to <span className="font-medium text-navy">{Math.min(endIndex, packageDescriptions.length)}</span> of <span className="font-medium text-navy">{packageDescriptions.length}</span>
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentPackageDescriptionPage(p => Math.max(p - 1, 1))} disabled={currentPackageDescriptionPage === 1} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Prev</button>
                  <button onClick={() => setCurrentPackageDescriptionPage(p => Math.min(p + 1, totalPages))} disabled={currentPackageDescriptionPage === totalPages} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </section>
        </div>

        {packageDescriptionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]" onClick={() => setPackageDescriptionToDelete(null)} />
            <div className="surface-card relative z-10 w-full max-w-md p-6 animate-rise">
              <div className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Delete record</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Are you sure you want to delete this description? This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setPackageDescriptionToDelete(null)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent">Cancel</button>
                <button onClick={() => void confirmDeletePackageDescription()} disabled={!!deletingPackageDescriptionId} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-destructive text-white hover:brightness-110 disabled:opacity-45">
                  {deletingPackageDescriptionId ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}