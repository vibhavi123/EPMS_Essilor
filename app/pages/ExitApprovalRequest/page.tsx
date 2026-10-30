"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import {
  RefreshCw,
  Trash2,
  Search,
  X,
} from "lucide-react";

interface EmployeeProfileData {
  id: number;
  employeeId: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  company: string | null;
}

interface EmployeeExitRequestRecord {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeCompany: string | null;
  department: string | null;
  requestReason: string | null;
  requestedAt: string | null;
  approvedByAccessId: string | null;
  approvedByName: string | null;
  approvedByRole: string | null;
  status: string;
  approvedAt: string | null;
  usedAt: string | null;
}

export default function ExitApprovalRequestPage() {
  const [employee, setEmployee] = useState<EmployeeProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [myRequests, setMyRequests] = useState<EmployeeExitRequestRecord[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const requestsPerPage = 10;

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const fetchEmployeeAndRequests = useCallback(async () => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/exit-approvals?meEmployee=1");
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.message || "Could not load your Employee ID and profile."
        );
      }
      if (data?.data?.employee) {
        setEmployee(data.data.employee as EmployeeProfileData);
        setProfileError(null);
      } else {
        setEmployee(null);
        setProfileError(data?.message || "No Employee ID linked to this account.");
      }
      setMyRequests(
        Array.isArray(data?.data?.requests)
          ? (data.data.requests as EmployeeExitRequestRecord[])
          : []
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load Employee ID";
      setEmployee(null);
      setProfileError(msg);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    void fetchEmployeeAndRequests();
    const interval = setInterval(() => {
      void fetchEmployeeAndRequests();
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchEmployeeAndRequests]);

  const handleSubmitRequest = async () => {
    if (!employee) {
      setAlertModal({
        isOpen: true,
        title: "No Employee ID",
        message: "You cannot request exit approval because your account does not have a linked Employee ID.",
        type: "error",
      });
      return;
    }
    if (!requestReason.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Reason Required",
        message: "Please enter a reason for your exit approval request.",
        type: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/exit-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          requestReason: requestReason.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to send exit approval request");
      }

      setRequestReason("");
      await fetchEmployeeAndRequests();

      setAlertModal({
        isOpen: true,
        title: "Exit Request Sent",
        message:
          data?.message ||
          `Your exit approval request (${employee.employeeId}) has been sent to Admin / SuperAdmin. Once approved, you can exit at Gate Control.`,
        type: "success",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit exit request";
      setAlertModal({
        isOpen: true,
        title: "Request Error",
        message: msg,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: number) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/exit-approvals?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to cancel request");
      }
      await fetchEmployeeAndRequests();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to cancel request";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: msg,
        type: "error",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredRequests = myRequests.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.status.toLowerCase().includes(q) ||
      (r.requestReason || "").toLowerCase().includes(q) ||
      (r.approvedByName || "").toLowerCase().includes(q) ||
      (r.approvedByAccessId || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / requestsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * requestsPerPage;
  const paginatedRequests = filteredRequests.slice(
    startIndex,
    startIndex + requestsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"> Pending Approval
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
             Approved (Ready to Exit)
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            Rejected
          </span>
        );
      case "used":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            Used (Exited)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 min-w-0 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all duration-300">
        <br />

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">
              Request Exit Approval
            </h1>

          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form
          className="space-y-10 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitRequest();
          }}
        >
          {/* Step 1: Auto-Detected Employee Information */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
              1. Employee Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-6">
                <InputLabel label="Your Employee ID *" />
                <input
                  type="text"
                  readOnly
                  value={
                    isLoadingProfile
                      ? "Loading your Employee ID..."
                      : employee?.employeeId || "No Employee ID"
                  }
                  placeholder="Employee ID (EMP...)"
                  className={`w-full px-4 py-3 border rounded-lg font-mono text-lg font-bold cursor-default focus:outline-none ${
                    !employee && !isLoadingProfile
                      ? "bg-red-50 border-red-300 text-red-600"
                      : "bg-gray-100 border-gray-300 text-[#0c244c]"
                  }`}
                />
                {profileError && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {profileError}
                  </p>
                )}

                <div className="mt-6">
                  <InputLabel label="Reason for Exit Request *" />
                  <input
                    type="text"
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder={
                      employee
                        ? "e.g. Personal errand, Medical appointment, Field visit (required)"
                        : "Cannot request exit without an Employee ID"
                    }
                    disabled={!employee || isSubmitting}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0084c8] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="md:col-span-6">
                <InputLabel label="Employee Details" />
                <div className="w-full min-h-32 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  {employee ? (
                    <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Name
                          </span>
                          <div className="font-semibold text-[#0c244c]">
                            {employee.fullName || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Employee ID
                          </span>
                          <div className="font-mono font-bold text-[#0084c8]">
                            {employee.employeeId}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Department
                          </span>
                          <div>{employee.department || "N/A"}</div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Company
                          </span>
                          <div>{employee.company || "N/A"}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full min-h-24 items-center justify-center text-sm text-gray-500 text-center p-2">
                      {isLoadingProfile ? (
                        "Loading your Employee details..."
                      ) : (
                        <>
                          <span className="font-semibold text-red-600">No Employee ID Found</span>
                          <span className="text-xs text-gray-500 mt-1">
                            Your account is not linked to any Employee ID in the system.
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Submit Request Button */}
          <div className="flex justify-center md:justify-end pt-2 pb-6">
            <button
              type="submit"
              disabled={isSubmitting || !employee || !requestReason.trim()}
              className="w-full md:w-72 inline-flex items-center justify-center gap-2 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Sending Request..."
                : !employee
                ? "No Employee ID"
                : "Send Exit Request"}
            </button>
          </div>
        </form>

        {/* My Exit Approval Requests Table */}
        <section className="w-full mt-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[#5a677a]">
                My Exit Approval Requests ({myRequests.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void fetchEmployeeAndRequests()}
              disabled={isLoadingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={isLoadingProfile ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-gray-200 p-4 bg-white">
              <div className="relative flex-1 sm:max-w-md">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by status, reason, or approver..."
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm text-[#0c244c] placeholder:text-gray-400 focus:border-[#0084c8] focus:outline-none focus:ring-2 focus:ring-[#0084c8]/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {isLoadingProfile && myRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading your exit requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No exit approval requests found.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-5 py-3">Employee ID</th>
                        <th className="px-5 py-3">Reason</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Requested Time</th>
                        <th className="px-5 py-3">Approved By</th>
                        <th className="px-5 py-3">Expires At </th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedRequests.map((req) => {
                        const reqDate = req.requestedAt
                          ? new Date(req.requestedAt)
                          : req.approvedAt
                          ? new Date(req.approvedAt)
                          : null;
                        const appDate = req.approvedAt
                          ? new Date(req.approvedAt)
                          : null;
                        const expDate =
                          req.status === "approved" && appDate
                            ? new Date(appDate.getTime() + 12 * 60 * 60 * 1000)
                            : null;

                        return (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3.5 font-mono font-bold text-[#0084c8]">
                              {req.employeeId}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              {req.requestReason || "General Exit Request"}
                            </td>
                            <td className="px-5 py-3.5">
                              {getStatusBadge(req.status)}
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs">
                              {reqDate ? reqDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700 text-xs">
                              {req.approvedByName ? (
                                <>
                                  <span className="font-semibold">
                                    {req.approvedByName}
                                  </span>{" "}
                                  {req.approvedByAccessId && (
                                    <span className="font-mono text-[#0084c8]">
                                      ({req.approvedByAccessId})
                                    </span>
                                  )}
                                </>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-amber-700 font-medium text-xs">
                              {expDate ? expDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {req.status === "pending" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCancelRequest(req.id)
                                  }
                                  disabled={cancellingId === req.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  {cancellingId === req.id
                                    ? "Cancelling..."
                                    : "Cancel"}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/60 px-5 py-3 flex-wrap gap-3">
                  <p className="text-xs text-gray-600">
                    Showing{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {startIndex + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {Math.min(
                        startIndex + requestsPerPage,
                        filteredRequests.length
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {filteredRequests.length}
                    </span>{" "}
                    requests
                  </p>
                  <div className="flex gap-1 items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={safeCurrentPage === 1}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-[#0c244c] transition-all hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(p + 1, totalPages))
                      }
                      disabled={safeCurrentPage === totalPages}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-[#0c244c] transition-all hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-lg font-medium text-[#2d3748] mb-2 ml-1">
      {label}
    </label>
  );
}
