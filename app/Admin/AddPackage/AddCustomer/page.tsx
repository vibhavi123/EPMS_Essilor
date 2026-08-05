"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { createCustomer } from "@/lib/api/customers";
import { Customer } from "@/utils/formTypes";

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
                        <th className="px-4 py-3 text-right">Action</th>
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
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentCustomerPage(page)}
                            className={`px-3 py-2 rounded-lg font-bold transition-all ${
                              currentCustomerPage === page
                                ? "bg-[#3ea5d9] text-white"
                                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
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
            Add Customer Information
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('en-US')}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          {success && createdCustomer ? (
            <section className="bg-white p-8 rounded-lg shadow-md">
              <div className="text-center">
                <div className="mb-6">
                  <div className="inline-block p-4 bg-green-100 rounded-full">
                    <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">Success!</h2>
                <p className="text-gray-600 mb-4">
                  Customer <strong>{createdCustomer.customerName}</strong> has been added successfully!
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  Customer ID: <span className="font-mono font-bold">{createdCustomer.id}</span>
                </p>
              </div>

              <div className="flex gap-4 justify-center pt-6 border-t border-gray-200">
                <button
                  onClick={handleCreateAnother}
                  className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  Add Another Customer
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
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerData.customerName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] focus:border-transparent"
                    placeholder="Enter customer name"
                  />
                </div>

                <div className="flex gap-4 justify-start pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                  >
                    {loading ? "Submitting..." : "Submit Customer Info"}
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

          {renderCustomerList()}
        </div>

        <DeleteConfirmModal
          isOpen={customerToDelete !== null}
          title="Remove Customer"
          message={
            customerToDelete
              ? `Remove ${customerToDelete.customerName} from the customer list?`
              : "Remove this customer from the list?"
          }
          confirmText="Remove"
          onCancel={() => setCustomerToDelete(null)}
          onConfirm={() => void confirmDeleteCustomer()}
          isSubmitting={deletingCustomerId !== null}
        />
      </main>
    </div>
  );
}