"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { DeliveryCompany } from "@/utils/formTypes";
import { createDeliveryCompany } from "@/lib/api/deliveryCompanies";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Plus, Search, X, Trash2 } from "lucide-react";

type DeliveryCompanyListItem = {
  id: number;
  deliveryCompany: string;
  createdAt?: string;
};

export default function AddDeliveryCompanyPage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  const [customerData, setCustomerData] = useState({
    deliveryCompany: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdDeliveryCompany, setCreatedDeliveryCompany] = useState<DeliveryCompany | null>(null);
  const [deliveryCompanies, setDeliveryCompanies] = useState<DeliveryCompanyListItem[]>([]);
  const [deliveryCompaniesLoading, setDeliveryCompaniesLoading] = useState(false);
  const [deliveryCompaniesError, setDeliveryCompaniesError] = useState("");
  const [deliveryCompanySearchQuery, setDeliveryCompanySearchQuery] = useState("");
  const [activeDeliveryCompanySearch, setActiveDeliveryCompanySearch] = useState("");
  const [deletingDeliveryCompanyId, setDeletingDeliveryCompanyId] = useState<number | null>(null);
  const [deliveryCompanyToDelete, setDeliveryCompanyToDelete] = useState<DeliveryCompanyListItem | null>(null);
  const [currentDeliveryCompanyPage, setCurrentDeliveryCompanyPage] = useState(1);
  const deliveryCompaniesPerPage = 10;

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAddPackage();
          return;
        }

        const canAccessDeliverySection = Boolean(data?.data?.permissions?.addPackageDelivery);
        if (!canAccessDeliverySection) {
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

  const fetchDeliveryCompanies = async (search = "") => {
    setDeliveryCompaniesLoading(true);
    setDeliveryCompaniesError("");
    setCurrentDeliveryCompanyPage(1);

    try {
      const params = new URLSearchParams({ limit: "500" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/delivery-companies?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load delivery companies");
      }

      const companiesList = Array.isArray(data.data) ? data.data : [];
      // Sort by newest first (createdAt descending)
      companiesList.sort((a: DeliveryCompanyListItem, b: DeliveryCompanyListItem) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setDeliveryCompanies(companiesList);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load delivery companies";
      setDeliveryCompaniesError(message);
    } finally {
      setDeliveryCompaniesLoading(false);
    }
  };

  useEffect(() => {
    void fetchDeliveryCompanies();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setCustomerData((prev) => ({ ...prev, deliveryCompany: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const trimmedName = customerData.deliveryCompany.trim();

    if (!trimmedName) {
      setError("Please enter delivery company name");
      setLoading(false);
      return;
    }

    // Check if delivery company already exists in the list
    const existingDeliveryCompany = deliveryCompanies.find(
      (c) => c.deliveryCompany.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingDeliveryCompany) {
      setError(`Delivery company "${trimmedName}" already exists in the system`);
      setLoading(false);
      return;
    }

    try {
      const newDeliveryCompany = await createDeliveryCompany(trimmedName);
      setSuccess(true);
      setCreatedDeliveryCompany(newDeliveryCompany);
      setCustomerData({
        deliveryCompany: "",
      });
      // Refresh the delivery companies list to show the newly created company
      await fetchDeliveryCompanies(activeDeliveryCompanySearch || deliveryCompanySearchQuery);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedDeliveryCompany(null);
  };

  const handleDeliveryCompanySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveDeliveryCompanySearch(deliveryCompanySearchQuery.trim());
    await fetchDeliveryCompanies(deliveryCompanySearchQuery);
  };

  const handleDeliveryCompanySearchClear = async () => {
    setDeliveryCompanySearchQuery("");
    setActiveDeliveryCompanySearch("");
    await fetchDeliveryCompanies("");
  };

  const handleDeleteDeliveryCompany = async (deliveryCompany: DeliveryCompanyListItem) => {
    setDeliveryCompanyToDelete(deliveryCompany);
  };

  const confirmDeleteDeliveryCompany = async () => {
    if (!deliveryCompanyToDelete) {
      return;
    }

    setDeletingDeliveryCompanyId(deliveryCompanyToDelete.id);
    setDeliveryCompaniesError("");

    try {
      const response = await fetch(`/api/delivery-companies/${deliveryCompanyToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete delivery company");
      }

      await fetchDeliveryCompanies(activeDeliveryCompanySearch || deliveryCompanySearchQuery);

      if (createdDeliveryCompany?.id === deliveryCompanyToDelete.id) {
        setCreatedDeliveryCompany(null);
        setSuccess(false);
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete delivery company";
      setDeliveryCompaniesError(message);
    } finally {
      setDeletingDeliveryCompanyId(null);
      setDeliveryCompanyToDelete(null);
    }
  };

  const renderDeliveryCompanyList = () => (
    <section className="mt-10 bg-white p-8 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0c244c]">All Delivery Companies</h2>
          <p className="text-sm text-gray-500 mt-1">Search delivery companies by name.</p>
        </div>
        <div className="text-sm text-gray-500">
          {deliveryCompaniesLoading ? "Loading delivery companies..." : `${deliveryCompanies.length} delivery companies`}
        </div>
      </div>

      <form onSubmit={handleDeliveryCompanySearch} className="mb-6 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={deliveryCompanySearchQuery}
          onChange={(e) => setDeliveryCompanySearchQuery(e.target.value)}
          placeholder="Search by delivery company name"
          className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
        />
        <button
          type="submit"
          disabled={deliveryCompaniesLoading}
          className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void handleDeliveryCompanySearchClear()}
          disabled={deliveryCompaniesLoading || (!deliveryCompanySearchQuery && !activeDeliveryCompanySearch)}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Clear
        </button>
      </form>

      {activeDeliveryCompanySearch && (
        <div className="mb-4 text-sm text-gray-500">
          Showing results for <span className="font-semibold text-[#0c244c]">{activeDeliveryCompanySearch}</span>
        </div>
      )}

      {deliveryCompaniesError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
          <p className="text-red-700 font-medium">{deliveryCompaniesError}</p>
        </div>
      )}

      {deliveryCompaniesLoading ? (
        <div className="py-10 text-center text-gray-500">Loading delivery company records...</div>
      ) : deliveryCompanies.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No delivery companies have been created yet.</div>
      ) : (
        <>
          {(() => {
            const totalDeliveryCompanies = deliveryCompanies.length;
            const totalPages = Math.ceil(totalDeliveryCompanies / deliveryCompaniesPerPage);
            const startIndex = (currentDeliveryCompanyPage - 1) * deliveryCompaniesPerPage;
            const endIndex = startIndex + deliveryCompaniesPerPage;
            const paginatedCompanies = deliveryCompanies.slice(startIndex, endIndex);

            return (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Company ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedCompanies.map((deliveryCompany) => (
                <tr key={deliveryCompany.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-mono text-sm font-semibold text-[#0c244c]">
                    {deliveryCompany.id}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">
                    {deliveryCompany.deliveryCompany}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {deliveryCompany.createdAt ? new Date(deliveryCompany.createdAt).toLocaleDateString("en-US") : "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteDeliveryCompany(deliveryCompany)}
                      disabled={deletingDeliveryCompanyId === deliveryCompany.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                    >
                      {deletingDeliveryCompanyId === deliveryCompany.id ? "Removing..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

                {totalDeliveryCompanies > 0 && totalPages > 1 && (
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, totalDeliveryCompanies)} of {totalDeliveryCompanies} companies
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentDeliveryCompanyPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentDeliveryCompanyPage === 1 || deliveryCompaniesLoading}
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
                          return getPageNumbers(currentDeliveryCompanyPage, totalPages).map((page, index) =>
                            typeof page === "number" ? (
                              <button
                                key={`page-${page}`}
                                onClick={() => setCurrentDeliveryCompanyPage(page)}
                                className={`px-3 py-2 rounded-lg font-bold transition-all text-sm ${
                                  currentDeliveryCompanyPage === page
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
                        onClick={() => setCurrentDeliveryCompanyPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentDeliveryCompanyPage === totalPages || deliveryCompaniesLoading}
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

  const totalPages = Math.ceil(deliveryCompanies.length / deliveryCompaniesPerPage);
  const startIndex = (currentDeliveryCompanyPage - 1) * deliveryCompaniesPerPage;
  const endIndex = startIndex + deliveryCompaniesPerPage;
  const paged = deliveryCompanies.slice(startIndex, endIndex);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Delivery Company Management</h1>
          </div>
          <div>
            <button onClick={() => nav.goToAddPackage()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] transition-all">
              <ArrowLeft className="size-4" /> Back to Hub
            </button>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-6 w-full">
          <section className="surface-card p-6 animate-rise">
            <h2 className="text-base font-bold text-navy">Add Delivery Company</h2>
            {success && createdDeliveryCompany && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success animate-rise">
                  <CheckCircle2 className="size-5 shrink-0" />
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
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery Company Name</label>
                  <input value={customerData.deliveryCompany} onChange={handleChange} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
                  {error && <p className="flex items-center gap-1 text-[12px] font-medium text-destructive animate-rise"><AlertTriangle className="size-3.5" /> {error}</p>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-6 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none">
                    {loading ? <><Loader2 className="size-4 animate-spin" /> Adding...</> : 'Add Delivery Company'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="surface-card overflow-hidden animate-rise">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={deliveryCompanySearchQuery} onChange={(e) => setDeliveryCompanySearchQuery(e.target.value)} placeholder="Search..." className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleDeliveryCompanySearch} disabled={deliveryCompaniesLoading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-gradient-brand text-white active:scale-[0.97] disabled:opacity-45">Search</button>
                <button onClick={() => void handleDeliveryCompanySearchClear()} disabled={deliveryCompaniesLoading || (!deliveryCompanySearchQuery && !activeDeliveryCompanySearch)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45"><X className="size-4" /> Clear</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-secondary/70">
                    <th className="w-auto px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Company Name</th>
                    <th className="w-36 sm:w-44 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created Date</th>
                    <th className="w-20 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map(item => (
                    <tr key={item.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-5 py-3.5 text-sm font-semibold text-navy break-words break-all whitespace-pre-wrap">{item.deliveryCompany}</td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US") : "-"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => void handleDeleteDeliveryCompany(item)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95" aria-label="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {deliveryCompaniesLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</td>
                    </tr>
                  )}
                  {!deliveryCompaniesLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {deliveryCompanies.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-3">
                <p className="text-[13px] text-muted-foreground">
                  Showing <span className="font-medium text-navy">{startIndex + 1}</span> to <span className="font-medium text-navy">{Math.min(endIndex, deliveryCompanies.length)}</span> of <span className="font-medium text-navy">{deliveryCompanies.length}</span>
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentDeliveryCompanyPage(p => Math.max(p - 1, 1))} disabled={currentDeliveryCompanyPage === 1} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Prev</button>
                  <button onClick={() => setCurrentDeliveryCompanyPage(p => Math.min(p + 1, totalPages))} disabled={currentDeliveryCompanyPage === totalPages} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </section>
        </div>

        {deliveryCompanyToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]" onClick={() => setDeliveryCompanyToDelete(null)} />
            <div className="surface-card relative z-10 w-full max-w-md p-6 animate-rise">
              <div className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Delete record</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Are you sure you want to delete "{deliveryCompanyToDelete.deliveryCompany}"? This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setDeliveryCompanyToDelete(null)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent">Cancel</button>
                <button onClick={() => void confirmDeleteDeliveryCompany()} disabled={!!deletingDeliveryCompanyId} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-destructive text-white hover:brightness-110 disabled:opacity-45">
                  {deletingDeliveryCompanyId ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}