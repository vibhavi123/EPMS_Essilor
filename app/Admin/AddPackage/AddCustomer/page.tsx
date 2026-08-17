"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { createCustomer } from "@/lib/api/customers";
import { Customer } from "@/utils/formTypes";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Plus, Search, X, Trash2 } from "lucide-react";

type CustomerListItem = {
  id: number;
  customerName: string;
  createdAt?: string;
};

export default function AddCustomerPage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  const [customerData, setCustomerData] = useState({
    customerName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [activeCustomerSearch, setActiveCustomerSearch] = useState("");
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerListItem | null>(null);
  const [currentCustomerPage, setCurrentCustomerPage] = useState(1);
  const customersPerPage = 10;

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAddPackage();
          return;
        }

        const canAccessCustomerSection = Boolean(data?.data?.permissions?.addPackageCustomer);
        if (!canAccessCustomerSection) {
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

  const fetchCustomers = async (search = "") => {
    setCustomersLoading(true);
    setCustomersError("");
    setCurrentCustomerPage(1);

    try {
      const params = new URLSearchParams({ limit: "500" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/customers?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load customers");
      }

      const customersList = Array.isArray(data.data) ? data.data : [];
      // Sort by newest first (createdAt descending)
      customersList.sort((a: CustomerListItem, b: CustomerListItem) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setCustomers(customersList);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load customers";
      setCustomersError(message);
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setCustomerData((prev) => ({ ...prev, customerName: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const trimmedName = customerData.customerName.trim();

    if (!trimmedName) {
      setError("Please enter customer name");
      setLoading(false);
      return;
    }

    // Check if customer already exists in the list
    const existingCustomer = customers.find(
      (c) => c.customerName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCustomer) {
      setError(`Customer "${trimmedName}" already exists in the system`);
      setLoading(false);
      return;
    }

    try {
      const newCustomer = await createCustomer(trimmedName);
      setSuccess(true);
      setCreatedCustomer(newCustomer);
      setCustomerData({
        customerName: "",
      });
      // Refresh the customers list to show the newly created customer
      await fetchCustomers(activeCustomerSearch || customerSearchQuery);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedCustomer(null);
  };

  const handleCustomerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveCustomerSearch(customerSearchQuery.trim());
    await fetchCustomers(customerSearchQuery);
  };

  const handleCustomerSearchClear = async () => {
    setCustomerSearchQuery("");
    setActiveCustomerSearch("");
    await fetchCustomers("");
  };

  const handleDeleteCustomer = async (customer: CustomerListItem) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) {
      return;
    }

    setDeletingCustomerId(customerToDelete.id);
    setCustomersError("");

    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete customer");
      }

      await fetchCustomers(activeCustomerSearch || customerSearchQuery);

      if (createdCustomer?.id === customerToDelete.id) {
        setCreatedCustomer(null);
        setSuccess(false);
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete customer";
      setCustomersError(message);
    } finally {
      setDeletingCustomerId(null);
      setCustomerToDelete(null);
    }
  };

  const renderCustomerList = () => (
    <section className="mt-10 bg-white p-8 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0c244c]">All Customers</h2>
          <p className="text-sm text-gray-500 mt-1">Search customers by name.</p>
        </div>
        <div className="text-sm text-gray-500">
          {customersLoading ? "Loading customers..." : `${customers.length} customers`}
        </div>
      </div>

      <form onSubmit={handleCustomerSearch} className="mb-6 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={customerSearchQuery}
          onChange={(e) => setCustomerSearchQuery(e.target.value)}
          placeholder="Search by customer name"
          className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
        />
        <button
          type="submit"
          disabled={customersLoading}
          className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void handleCustomerSearchClear()}
          disabled={customersLoading || (!customerSearchQuery && !activeCustomerSearch)}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Clear
        </button>
      </form>

      {activeCustomerSearch && (
        <div className="mb-4 text-sm text-gray-500">
          Showing results for <span className="font-semibold text-[#0c244c]">{activeCustomerSearch}</span>
        </div>
      )}

      {customersError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
          <p className="text-red-700 font-medium">{customersError}</p>
        </div>
      )}

      {customersLoading ? (
        <div className="py-10 text-center text-gray-500">Loading customer records...</div>
      ) : customers.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No customers have been created yet.</div>
      ) : (
        <>
          {(() => {
            const totalCustomers = customers.length;
            const totalPages = Math.ceil(totalCustomers / customersPerPage);
            const startIndex = (currentCustomerPage - 1) * customersPerPage;
            const endIndex = startIndex + customersPerPage;
            const paginatedCustomers = customers.slice(startIndex, endIndex);

            return (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Customer ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-mono text-sm font-semibold text-[#0c244c]">
                    {customer.id}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">
                    {customer.customerName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-US") : "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCustomer(customer)}
                      disabled={deletingCustomerId === customer.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                    >
                      {deletingCustomerId === customer.id ? "Removing..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
                    </tbody>
                  </table>
                </div>

                {totalCustomers > 0 && totalPages > 1 && (
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, totalCustomers)} of {totalCustomers} customers
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentCustomerPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentCustomerPage === 1 || customersLoading}
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
                          return getPageNumbers(currentCustomerPage, totalPages).map((page, index) =>
                            typeof page === "number" ? (
                              <button
                                key={`page-${page}`}
                                onClick={() => setCurrentCustomerPage(page)}
                                className={`px-3 py-2 rounded-lg font-bold transition-all text-sm ${
                                  currentCustomerPage === page
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
                        onClick={() => setCurrentCustomerPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentCustomerPage === totalPages || customersLoading}
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

  const totalPages = Math.ceil(customers.length / customersPerPage);
  const startIndex = (currentCustomerPage - 1) * customersPerPage;
  const endIndex = startIndex + customersPerPage;
  const paged = customers.slice(startIndex, endIndex);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Customer Information Management</h1>
          </div>
          <div>
            <button onClick={() => nav.goToAddPackage()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] transition-all">
              <ArrowLeft className="size-4" /> Back to Hub
            </button>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-6 w-full">
          <section className="surface-card p-6 animate-rise">
            <h2 className="text-base font-bold text-navy">Add Customer</h2>
            {success && createdCustomer && (
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
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Customer Name</label>
                  <input value={customerData.customerName} onChange={handleChange} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
                  {error && <p className="flex items-center gap-1 text-[12px] font-medium text-destructive animate-rise"><AlertTriangle className="size-3.5" /> {error}</p>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold h-11 px-6 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none">
                    {loading ? <><Loader2 className="size-4 animate-spin" /> Adding...</> : 'Add Customer'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="surface-card overflow-hidden animate-rise">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={customerSearchQuery} onChange={(e) => setCustomerSearchQuery(e.target.value)} placeholder="Search..." className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCustomerSearch} disabled={customersLoading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-gradient-brand text-white active:scale-[0.97] disabled:opacity-45">Search</button>
                <button onClick={() => void handleCustomerSearchClear()} disabled={customersLoading || (!customerSearchQuery && !activeCustomerSearch)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 sm:h-9 px-4 sm:px-3 text-[13px] bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45"><X className="size-4" /> Clear</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-secondary/70">
                    <th className="w-auto px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer Name</th>
                    <th className="w-36 sm:w-44 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created Date</th>
                    <th className="w-20 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map(item => (
                    <tr key={item.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-5 py-3.5 text-sm font-semibold text-navy break-words break-all whitespace-pre-wrap">{item.customerName}</td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US") : "-"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => void handleDeleteCustomer(item)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95" aria-label="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customersLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</td>
                    </tr>
                  )}
                  {!customersLoading && paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {customers.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-3">
                <p className="text-[13px] text-muted-foreground">
                  Showing <span className="font-medium text-navy">{startIndex + 1}</span> to <span className="font-medium text-navy">{Math.min(endIndex, customers.length)}</span> of <span className="font-medium text-navy">{customers.length}</span>
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentCustomerPage(p => Math.max(p - 1, 1))} disabled={currentCustomerPage === 1} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Prev</button>
                  <button onClick={() => setCurrentCustomerPage(p => Math.min(p + 1, totalPages))} disabled={currentCustomerPage === totalPages} className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-navy transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </section>
        </div>

        {customerToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]" onClick={() => setCustomerToDelete(null)} />
            <div className="surface-card relative z-10 w-full max-w-md p-6 animate-rise">
              <div className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Delete record</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Are you sure you want to delete "{customerToDelete.customerName}"? This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setCustomerToDelete(null)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent">Cancel</button>
                <button onClick={() => void confirmDeleteCustomer()} disabled={!!deletingCustomerId} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-destructive text-white hover:brightness-110 disabled:opacity-45">
                  {deletingCustomerId ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}