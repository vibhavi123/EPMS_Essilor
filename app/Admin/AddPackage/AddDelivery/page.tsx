"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { DeliveryCompany } from "@/utils/formTypes";
import { createDeliveryCompany } from "@/lib/api/deliveryCompanies";

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
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentDeliveryCompanyPage(page)}
                            className={`px-3 py-2 rounded-lg font-bold transition-all ${
                              currentDeliveryCompanyPage === page
                                ? "bg-[#3ea5d9] text-white"
                                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
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
            Add Delivery Company Information
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('en-US')}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          {success && createdDeliveryCompany ? (
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
                  Delivery Company <strong>{createdDeliveryCompany.deliveryCompany}</strong> has been added successfully!
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  Delivery Company ID: <span className="font-mono font-bold">{createdDeliveryCompany.id}</span>
                </p>
              </div>

              <div className="flex gap-4 justify-center pt-6 border-t border-gray-200">
                <button
                  onClick={handleCreateAnother}
                  className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  Add Another Delivery Company
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
                    Delivery Company Name *
                  </label>
                  <input
                    type="text"
                    value={customerData.deliveryCompany}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] focus:border-transparent"
                    placeholder="Enter delivery company name"
                  />
                </div>

                <div className="flex gap-4 justify-start pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                  >
                    {loading ? "Submitting..." : "Submit Delivery Company Info"}
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

          {renderDeliveryCompanyList()}
        </div>

        <DeleteConfirmModal
          isOpen={deliveryCompanyToDelete !== null}
          title="Remove Delivery Company"
          message={
            deliveryCompanyToDelete
              ? `Remove ${deliveryCompanyToDelete.deliveryCompany} from the delivery company list?`
              : "Remove this delivery company from the list?"
          }
          confirmText="Remove"
          onCancel={() => setDeliveryCompanyToDelete(null)}
          onConfirm={() => void confirmDeleteDeliveryCompany()}
          isSubmitting={deletingDeliveryCompanyId !== null}
        />
      </main>
    </div>
  );
}