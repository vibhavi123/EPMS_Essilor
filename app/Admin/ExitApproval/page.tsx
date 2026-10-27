"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import AlertModal from "@/components/AlertModal";
import { EmployeeData, EmployeeApiResponse } from "@/utils/formTypes";
import { CheckCircle2, Trash2, RefreshCw, Download, Search, X } from "lucide-react";
import { PermissionGuard } from "@/hooks/usePermissions";

interface ApproverEmployeeData {
  id: number;
  employeeId: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  company: string | null;
}

interface ExitApprovalRecord {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeCompany: string | null;
  department: string | null;
  requestReason?: string | null;
  requestedAt?: string | null;
  approvedByAccessId: string;
  approvedByName: string;
  approvedByRole: string;
  status: string;
  approvedAt: string | null;
  usedAt: string | null;
  gateRecordId?: number | null;
  exitReason?: string | null;
  departureTime?: string | null;
  returnTime?: string | null;
  guardId?: string | null;
}

function ExitApprovalPageContent() {
  const [selectedAdmin, setSelectedAdmin] = useState<ApproverEmployeeData | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [adminLoadError, setAdminLoadError] = useState<string | null>(null);

  const [employeeIdInput, setEmployeeIdInput] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<EmployeeData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ExitApprovalRecord[]>([]);
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const pendingPerPage = 10;
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [activeApprovals, setActiveApprovals] = useState<ExitApprovalRecord[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const approvalsPerPage = 10;

  const employeeInputRef = useRef<HTMLInputElement>(null);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

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

  // Automatically load the logged-in Admin / SuperAdmin's Employee ID
  const fetchLoggedInApprover = useCallback(async () => {
    setIsLoadingAdmin(true);
    setAdminLoadError(null);
    try {
      const res = await fetch("/api/exit-approvals?meApprover=1");
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.data) {
        throw new Error(
          data?.message ||
            "Could not load your Admin / SuperAdmin Employee ID."
        );
      }

      setSelectedAdmin(data.data as ApproverEmployeeData);
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 100);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load Approver Employee ID";
      setSelectedAdmin(null);
      setAdminLoadError(msg);
    } finally {
      setIsLoadingAdmin(false);
    }
  }, []);

  const fetchActiveApprovals = useCallback(async () => {
    setIsLoadingApprovals(true);
    try {
      const [approvedRes, pendingRes] = await Promise.all([
        fetch("/api/exit-approvals?status=approved"),
        fetch("/api/exit-approvals?status=pending"),
      ]);
      const [approvedData, pendingData] = await Promise.all([
        approvedRes.json(),
        pendingRes.json(),
      ]);

      const twelveHoursMs = 12 * 60 * 60 * 1000;
      const now = Date.now();

      if (approvedRes.ok && approvedData?.success && Array.isArray(approvedData.data)) {
        const validApprovals = (approvedData.data as ExitApprovalRecord[]).filter(
          (item) =>
            !item.approvedAt ||
            now - new Date(item.approvedAt).getTime() < twelveHoursMs
        );
        setActiveApprovals(validApprovals);
      }

      if (pendingRes.ok && pendingData?.success && Array.isArray(pendingData.data)) {
        const validPending = (pendingData.data as ExitApprovalRecord[]).filter(
          (item) =>
            !item.requestedAt ||
            now - new Date(item.requestedAt).getTime() < twelveHoursMs
        );
        setPendingRequests(validPending);
      }
    } catch {
      // silent fail on list load
    } finally {
      setIsLoadingApprovals(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoggedInApprovalsInit();
    async function fetchLoggedInApprovalsInit() {
      await Promise.all([fetchLoggedInApprover(), fetchActiveApprovals()]);
    }
    const interval = setInterval(() => {
      void fetchActiveApprovals();
    }, 20 * 1000);
    return () => clearInterval(interval);
  }, [fetchLoggedInApprover, fetchActiveApprovals]);

  // Search & Pagination helpers for Pending Employee Exit Requests table
  const filteredPendingRequests = pendingRequests.filter((item) => {
    const q = pendingSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.employeeId.toLowerCase().includes(q) ||
      item.employeeName.toLowerCase().includes(q) ||
      (item.department || "").toLowerCase().includes(q) ||
      (item.employeeCompany || "").toLowerCase().includes(q) ||
      (item.requestReason || "").toLowerCase().includes(q)
    );
  });

  const pendingTotalPages = Math.max(
    1,
    Math.ceil(filteredPendingRequests.length / pendingPerPage)
  );
  const safePendingCurrentPage = Math.min(pendingCurrentPage, pendingTotalPages);
  const pendingStartIndex = (safePendingCurrentPage - 1) * pendingPerPage;
  const paginatedPendingRequests = filteredPendingRequests.slice(
    pendingStartIndex,
    pendingStartIndex + pendingPerPage
  );

  // Search & Pagination helpers for Approved Employees table
  const filteredApprovals = activeApprovals.filter((item) => {
    const q = tableSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.employeeId.toLowerCase().includes(q) ||
      item.employeeName.toLowerCase().includes(q) ||
      (item.department || "").toLowerCase().includes(q) ||
      (item.employeeCompany || "").toLowerCase().includes(q) ||
      (item.requestReason || "").toLowerCase().includes(q) ||
      (item.exitReason || "").toLowerCase().includes(q) ||
      item.approvedByName.toLowerCase().includes(q) ||
      item.approvedByAccessId.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / approvalsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * approvalsPerPage;
  const paginatedApprovals = filteredApprovals.slice(
    startIndex,
    startIndex + approvalsPerPage
  );

  const getPageNumbers = (current: number, total: number): (number | string)[] => {
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

  // Close autocomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionBoxRef.current &&
        !suggestionBoxRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch matching employees when typing in the Requesting Employee input
  useEffect(() => {
    const query = employeeIdInput.trim();
    if (!query || selectedEmployee?.employeeId === query) {
      setEmployeeSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/employees?scope=all&limit=8&search=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data.data)) {
          setEmployeeSuggestions(data.data);
          setShowSuggestions(true);
        }
      } catch {
        setEmployeeSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [employeeIdInput, selectedEmployee]);

  const isUserAccountIdFormat = (val: string) => {
    const upper = val.trim().toUpperCase();
    return (
      upper.startsWith("ADM") ||
      upper.startsWith("SUP") ||
      upper.startsWith("GRD") ||
      upper.startsWith("USR")
    );
  };

  const lookupEmployeeById = async (rawEmployeeId: string) => {
    const trimmedEmployeeId = rawEmployeeId.trim();
    if (!trimmedEmployeeId) return;

    setShowSuggestions(false);

    if (isUserAccountIdFormat(trimmedEmployeeId)) {
      setSelectedEmployee(null);
      setAlertModal({
        isOpen: true,
        title: "Invalid ID Type",
        message:
          "User account IDs (ADM / SUP / GRD) cannot be used in Exit Approval. Only an Employee ID (EMP...) is allowed.",
        type: "error",
      });
      return;
    }

    if (!selectedAdmin) {
      setAlertModal({
        isOpen: true,
        title: "Approver Employee ID Required",
        message:
          "Your Admin / SuperAdmin Employee ID could not be verified. Please ensure you are logged in with an Admin or SuperAdmin account.",
        type: "warning",
      });
      return;
    }

    setIsLoadingEmployee(true);
    try {
      const response = await fetch(
        `/api/employees/${encodeURIComponent(trimmedEmployeeId)}`
      );
      const contentType = response.headers.get("content-type") || "";
      let data: EmployeeApiResponse;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          `Unexpected response from server: ${response.status} - ${text.slice(0, 200)}`
        );
      }

      if (!response.ok || !data?.success || !data?.data) {
        // Fallback: if user typed a partial ID or name, try searching by query
        const searchRes = await fetch(
          `/api/employees?scope=all&limit=5&search=${encodeURIComponent(trimmedEmployeeId)}`
        );
        const searchData = await searchRes.json();
        if (
          searchRes.ok &&
          searchData?.success &&
          Array.isArray(searchData.data) &&
          searchData.data.length === 1
        ) {
          const matchedEmp = searchData.data[0] as EmployeeData;
          setSelectedEmployee(matchedEmp);
          setEmployeeIdInput(matchedEmp.employeeId);
          return;
        }
        throw new Error(
          data?.message ||
            "Employee not found. Please scan or type a valid Employee ID (EMP...)."
        );
      }

      const employee = data.data as EmployeeData;
      setSelectedEmployee(employee);
      setEmployeeIdInput(employee.employeeId || trimmedEmployeeId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setSelectedEmployee(null);
      setAlertModal({
        isOpen: true,
        title: "Employee Lookup Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoadingEmployee(false);
    }
  };

  const validateMandatoryFields = () => {
    const missingFields: string[] = [];

    if (!selectedAdmin || !selectedAdmin.employeeId) {
      missingFields.push("Approver Employee ID (Admin / SuperAdmin)");
    }
    if (!selectedEmployee || !employeeIdInput.trim()) {
      missingFields.push("Requesting Employee ID (scan or type and click Insert)");
    }
    if (!approvalReason.trim()) {
      missingFields.push("Reason for Exit");
    }

    if (missingFields.length > 0) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: `Please complete all mandatory steps:\n\n${missingFields
          .map((f) => `• ${f}`)
          .join("\n")}`,
        type: "warning",
      });
      return false;
    }
    return true;
  };

  const handleSubmitApproval = async () => {
    if (!validateMandatoryFields()) return;
    if (!selectedAdmin || !selectedEmployee) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/exit-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverEmployeeId: selectedAdmin.employeeId,
          employeeId: selectedEmployee.employeeId,
          requestReason: approvalReason.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to submit exit approval");
      }

      const approvedEmpName = selectedEmployee.employeeName;
      const approvedEmpId = selectedEmployee.employeeId;

      setEmployeeIdInput("");
      setSelectedEmployee(null);
      setApprovalReason("");
      setEmployeeSuggestions([]);
      setShowSuggestions(false);

      await fetchActiveApprovals();

      setAlertModal({
        isOpen: true,
        title: "Approval Submitted",
        message: `Exit approval granted for ${approvedEmpName} (${approvedEmpId}) by Approver Employee ID ${selectedAdmin.employeeId}.\n\nThey are now permitted to exit the company.`,
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit approval";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeApproval = async (id: number) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/exit-approvals?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to revoke approval");
      }
      await fetchActiveApprovals();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to revoke approval";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleApprovePendingRequest = async (reqItem: ExitApprovalRecord) => {
    setProcessingRequestId(reqItem.id);
    try {
      const res = await fetch("/api/exit-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approveRequest",
          requestId: reqItem.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to approve request");
      }
      await fetchActiveApprovals();
      setAlertModal({
        isOpen: true,
        title: "Request Approved",
        message:
          data?.message ||
          `Exit request approved for ${reqItem.employeeName}.`,
        type: "success",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to approve request";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectPendingRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      const res = await fetch("/api/exit-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rejectRequest",
          requestId: id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to reject request");
      }
      await fetchActiveApprovals();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to reject request";
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: errorMessage,
        type: "error",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const escapeCsvCell = (value?: string | number | null) => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const handleDownloadCsvReport = async () => {
    try {
      const res = await fetch("/api/exit-approvals?report=1");
      const json = await res.json();
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.message || "Failed to fetch exit approval records");
      }

      const records = json.data as ExitApprovalRecord[];
      if (records.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "No Records Found",
          message: "There are no Employee Exit Approval records to export.",
          type: "info",
        });
        return;
      }

      const headers = [
        "Approval ID",
        "Requesting Employee ID",
        "Requesting Employee Name",
        "Employee Department",
        "Employee Company",
        "Approver Employee ID",
        "Approver Name",
        "Approver Access Role",
        "Approval Status",
        "Approved Date",
        "Approved Time",
        "Expires At (12h Reset)",
        "Used At (Gate Exit)",
        "Exit Reason",
        "Departure Time",
        "Return Time",
        "Return Guard ID",
      ];

      const csvRows = [headers.map((h) => escapeCsvCell(h)).join(",")];

      for (const r of records) {
        const approvedDateObj = r.approvedAt ? new Date(r.approvedAt) : null;
        const approvedDateStr = approvedDateObj
          ? approvedDateObj.toLocaleDateString()
          : "";
        const approvedTimeStr = approvedDateObj
          ? approvedDateObj.toLocaleTimeString()
          : "";
        const expiresAtStr = approvedDateObj
          ? new Date(approvedDateObj.getTime() + 12 * 60 * 60 * 1000).toLocaleString()
          : "";
        const usedAtStr = r.usedAt ? new Date(r.usedAt).toLocaleString() : "";
        const roleLabel =
          r.approvedByRole === "superAdmin"
            ? "Super Admin"
            : r.approvedByRole === "admin"
            ? "Admin"
            : r.approvedByRole || "";

        const row = [
          escapeCsvCell(r.id),
          escapeCsvCell(r.employeeId),
          escapeCsvCell(r.employeeName),
          escapeCsvCell(r.department ?? "N/A"),
          escapeCsvCell(r.employeeCompany ?? "N/A"),
          escapeCsvCell(r.approvedByAccessId),
          escapeCsvCell(r.approvedByName),
          escapeCsvCell(roleLabel),
          escapeCsvCell(r.status),
          escapeCsvCell(approvedDateStr),
          escapeCsvCell(approvedTimeStr),
          escapeCsvCell(expiresAtStr),
          escapeCsvCell(usedAtStr || "Not Used"),
          escapeCsvCell(r.requestReason || r.exitReason || "N/A"),
          escapeCsvCell(r.departureTime ?? "N/A"),
          escapeCsvCell(r.returnTime ?? "N/A"),
          escapeCsvCell(r.guardId ?? "N/A"),
        ];

        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      const timeStamp = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
      link.href = url;
      link.download = `employee_exit_approvals_${dateStamp}_${timeStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to download CSV report";
      setAlertModal({
        isOpen: true,
        title: "CSV Export Error",
        message: errorMessage,
        type: "error",
      });
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
              Employee Exit Approval
            </h1>
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <form
          className="space-y-10 w-full"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* Step 1: Approver Employee Information (Auto-loaded from logged-in Admin / SuperAdmin) */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
              1. Approver Information 
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-6">
                <InputLabel label="Approver Employee ID *" />
                <div className="flex gap-3">
                  <input
                    type="text"
                    readOnly
                    value={
                      isLoadingAdmin
                        ? "Loading Approver Employee ID..."
                        : selectedAdmin?.employeeId || ""
                    }
                    placeholder="Approver Employee ID (EMP...)"
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg font-mono text-lg font-bold text-[#0c244c] cursor-default focus:outline-none"
                  />
                </div>
                {selectedAdmin && (
                  <p className="mt-2 text-xs font-semibold text-green-600 flex items-center gap-1">
                     Auto-verified Approver
                  </p>
                )}
                {adminLoadError && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {adminLoadError}
                  </p>
                )}
              </div>

              <div className="md:col-span-6">
                <InputLabel label="Approver Details" />
                <div className="w-full min-h-32 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  {selectedAdmin ? (
                    <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Name
                          </span>
                          <div className="font-semibold text-[#0c244c]">
                            {selectedAdmin.fullName || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Employee ID
                          </span>
                          <div className="font-mono font-bold text-[#0084c8]">
                            {selectedAdmin.employeeId}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Access Role
                          </span>
                          <div className="font-semibold text-[#0084c8]">
                            {selectedAdmin.role === "superAdmin"
                              ? "Super Admin"
                              : "Admin"}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Department
                          </span>
                          <div>{selectedAdmin.department || "N/A"}</div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Company
                          </span>
                          <div>{selectedAdmin.company || "N/A"}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-24 items-center justify-center text-sm text-gray-500 text-center">
                      {isLoadingAdmin
                        ? "Loading your Admin / SuperAdmin Employee details..."
                        : "Unable to load Admin / SuperAdmin Employee details."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Step 2: Requesting Employee Information (Scan or Type) */}
          <section>
            <h2 className="text-xl font-semibold text-[#5a677a] mb-6">
              2. Requesting Employee to Approve for Exit
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
              <div className="md:col-span-6" ref={suggestionBoxRef}>
                <InputLabel label="Employee ID *" />
                <div className="relative">
                  <div className="flex gap-3">
                    <input
                      ref={employeeInputRef}
                      type="text"
                      autoComplete="off"
                      inputMode="text"
                      value={employeeIdInput}
                      placeholder={
                        selectedAdmin
                          ? "Scan barcode or type Employee ID (e.g. EMP...)"
                          : "Waiting for Approver Employee ID..."
                      }
                      disabled={!selectedAdmin}
                      onFocus={() => {
                        if (employeeSuggestions.length > 0 && !selectedEmployee) {
                          setShowSuggestions(true);
                        }
                      }}
                      onChange={(e) => {
                        setEmployeeIdInput(e.target.value);
                        setSelectedEmployee(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void lookupEmployeeById(
                            (e.currentTarget as HTMLInputElement).value
                          );
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0084c8] font-mono text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => void lookupEmployeeById(employeeIdInput)}
                      disabled={
                        !selectedAdmin ||
                        isLoadingEmployee ||
                        !employeeIdInput.trim()
                      }
                      className="shrink-0 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-lg shadow transition-all active:scale-95 disabled:cursor-not-allowed"
                    >
                      {isLoadingEmployee ? "Checking..." : "Insert"}
                    </button>
                  </div>

                  {/* Autocomplete dropdown when typing Employee ID or Name */}
                  {showSuggestions && employeeSuggestions.length > 0 && !selectedEmployee && (
                    <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg divide-y divide-gray-100">
                      {employeeSuggestions.map((emp) => (
                        <li key={emp.employeeId}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setEmployeeIdInput(emp.employeeId);
                              setShowSuggestions(false);
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-[#0c244c]">
                                {emp.employeeName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {emp.department || "N/A"} · {emp.employeeCompany || "N/A"}
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold text-[#0084c8] bg-blue-50 px-2.5 py-1 rounded">
                              {emp.employeeId}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Reason for Exit Input */}
                <div className="mt-4">
                  <InputLabel label="Reason for Exit *" />
                  <input
                    type="text"
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    disabled={!selectedAdmin}
                    placeholder="Enter reason for leaving the company (e.g., Medical appointment, Official visit, Personal work...)"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0084c8] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="md:col-span-6">
                <InputLabel label="Requesting Employee Details" />
                <div className="w-full min-h-32 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  {selectedEmployee ? (
                    <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Name
                          </span>
                          <div className="font-semibold text-[#0c244c]">
                            {selectedEmployee.employeeName || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Employee ID
                          </span>
                          <div className="font-mono font-semibold text-[#0084c8]">
                            {selectedEmployee.employeeId || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Department
                          </span>
                          <div>{selectedEmployee.department || "N/A"}</div>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Company
                          </span>
                          <div>{selectedEmployee.employeeCompany || "N/A"}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-24 items-center justify-center text-sm text-gray-500 text-center">
                      No employee details yet. Scan or type an Employee ID (EMP...) and click Insert.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Buttons */}
          <div className="flex justify-center md:justify-end pt-4 pb-8 gap-4">
            <button
              type="button"
              onClick={() => void handleSubmitApproval()}
              disabled={isSubmitting || !selectedAdmin || !selectedEmployee}
              className="w-full md:w-64 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-300 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Approval"}
            </button>
          </div>
        </form>

        {/* Pending Employee Exit Requests Table */}
        <section className="w-full mt-4 mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[#5a677a]">
                Pending Employee Exit Requests ({pendingRequests.length})
              </h2>
            </div>
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
                  value={pendingSearchQuery}
                  onChange={(e) => {
                    setPendingSearchQuery(e.target.value);
                    setPendingCurrentPage(1);
                  }}
                  placeholder="Search by Employee ID, Name, Department, Company, or Reason..."
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm text-[#0c244c] placeholder:text-gray-400 focus:border-[#0084c8] focus:outline-none focus:ring-2 focus:ring-[#0084c8]/20"
                />
                {pendingSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSearchQuery("");
                      setPendingCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              {pendingSearchQuery.trim() && (
                <p className="text-xs text-gray-500">
                  Found{" "}
                  <span className="font-bold text-[#0c244c]">
                    {filteredPendingRequests.length}
                  </span>{" "}
                  matching request{filteredPendingRequests.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {isLoadingApprovals && pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading pending employee exit requests...
              </div>
            ) : filteredPendingRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {pendingSearchQuery.trim()
                  ? `No pending requests match "${pendingSearchQuery.trim()}".`
                  : "No pending exit requests from employees right now."}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-amber-50/70 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-600">
                        <th className="px-5 py-3">Employee ID</th>
                        <th className="px-5 py-3">Employee Name</th>
                        <th className="px-5 py-3">Department / Company</th>
                        <th className="px-5 py-3">Request Reason</th>
                        <th className="px-5 py-3">Requested Time</th>
                        <th className="px-5 py-3">Expires At </th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedPendingRequests.map((req) => {
                        const reqDate = req.requestedAt
                          ? new Date(req.requestedAt)
                          : null;
                        const reqExpiresDate = reqDate
                          ? new Date(reqDate.getTime() + 12 * 60 * 60 * 1000)
                          : null;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3.5 font-mono font-bold text-[#0084c8]">
                              {req.employeeId}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-[#0c244c]">
                              {req.employeeName}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">
                              {req.department || "N/A"} · {req.employeeCompany || "N/A"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              {req.requestReason || "General Exit Request"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs">
                              {reqDate ? reqDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-amber-700 font-medium text-xs">
                              {reqExpiresDate ? reqExpiresDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                              <button
                                type="button"
                                onClick={() => void handleApprovePendingRequest(req)}
                                disabled={
                                  processingRequestId === req.id || !selectedAdmin
                                }
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                              >
                                <CheckCircle2 size={14} />
                                {processingRequestId === req.id
                                  ? "Processing..."
                                  : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRejectPendingRequest(req.id)
                                }
                                disabled={processingRequestId === req.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                              >
                                <X size={14} />
                                Reject
                              </button>
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
                      {pendingStartIndex + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {Math.min(
                        pendingStartIndex + pendingPerPage,
                        filteredPendingRequests.length
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {filteredPendingRequests.length}
                    </span>{" "}
                    pending request{filteredPendingRequests.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex gap-1 items-center">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCurrentPage((p) => Math.max(p - 1, 1))
                      }
                      disabled={safePendingCurrentPage === 1 || isLoadingApprovals}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-[#0c244c] transition-all hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Prev
                    </button>
                    {getPageNumbers(
                      safePendingCurrentPage,
                      pendingTotalPages
                    ).map((page, idx) =>
                      typeof page === "number" ? (
                        <button
                          type="button"
                          key={`pending-page-${page}`}
                          onClick={() => setPendingCurrentPage(page)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition-all ${
                            safePendingCurrentPage === page
                              ? "bg-[#0084c8] text-white shadow-sm"
                              : "border border-gray-200 bg-white text-[#0c244c] hover:bg-gray-100"
                          }`}
                        >
                          {page}
                        </button>
                      ) : (
                        <span
                          key={`pending-ellipsis-${idx}`}
                          className="inline-flex h-8 w-8 items-center justify-center text-gray-400 text-xs font-bold"
                        >
                          {page}
                        </span>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCurrentPage((p) =>
                          Math.min(p + 1, pendingTotalPages)
                        )
                      }
                      disabled={
                        safePendingCurrentPage === pendingTotalPages ||
                        isLoadingApprovals
                      }
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

        {/* Active Pending Exit Approvals Table */}
        <section className="w-full mt-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[#5a677a]">
                Approved Employees Ready for Exit ({activeApprovals.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Approvals automatically reset after 12 hours if unused.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void fetchActiveApprovals()}
                disabled={isLoadingApprovals}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={isLoadingApprovals ? "animate-spin" : ""}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadCsvReport()}
                className="flex items-center gap-2 px-4 py-2 bg-[#0084c8] hover:bg-[#0071ad] text-white rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                <Download size={15} />
                Download CSV
              </button>
            </div>
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
                  value={tableSearchQuery}
                  onChange={(e) => {
                    setTableSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by Employee ID, Name, Department, Company, or Approver..."
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm text-[#0c244c] placeholder:text-gray-400 focus:border-[#0084c8] focus:outline-none focus:ring-2 focus:ring-[#0084c8]/20"
                />
                {tableSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTableSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              {tableSearchQuery.trim() && (
                <p className="text-xs text-gray-500">
                  Found{" "}
                  <span className="font-bold text-[#0c244c]">
                    {filteredApprovals.length}
                  </span>{" "}
                  matching record{filteredApprovals.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {isLoadingApprovals ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading active exit approvals...
              </div>
            ) : filteredApprovals.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {tableSearchQuery.trim()
                  ? `No approved employees match "${tableSearchQuery.trim()}".`
                  : "No employees currently waiting with active exit approval."}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-5 py-3">Employee ID</th>
                        <th className="px-5 py-3">Employee Name</th>
                        <th className="px-5 py-3">Department / Company</th>
                        <th className="px-5 py-3">Reason</th>
                        <th className="px-5 py-3">Approved By (Employee ID)</th>
                        <th className="px-5 py-3">Approved Time</th>
                        <th className="px-5 py-3">Expires At </th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedApprovals.map((item) => {
                        const approvedDate = item.approvedAt
                          ? new Date(item.approvedAt)
                          : null;
                        const expiresDate = approvedDate
                          ? new Date(approvedDate.getTime() + 12 * 60 * 60 * 1000)
                          : null;
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3.5 font-mono font-bold text-[#0084c8]">
                              {item.employeeId}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-[#0c244c]">
                              {item.employeeName}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">
                              {item.department || "N/A"} · {item.employeeCompany || "N/A"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              {item.requestReason || item.exitReason || "-"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              <span className="font-semibold">{item.approvedByName}</span>{" "}
                              <span className="font-mono text-xs font-bold text-[#0084c8]">
                                ({item.approvedByAccessId})
                              </span>{" "}
                              <span className="text-xs text-gray-500">
                                [{item.approvedByRole === "superAdmin" ? "Super Admin" : "Admin"}]
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs">
                              {approvedDate ? approvedDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-amber-700 font-medium text-xs">
                              {expiresDate ? expiresDate.toLocaleString() : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => void handleRevokeApproval(item.id)}
                                disabled={revokingId === item.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                {revokingId === item.id ? "Revoking..." : "Revoke"}
                              </button>
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
                        startIndex + approvalsPerPage,
                        filteredApprovals.length
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#0c244c]">
                      {filteredApprovals.length}
                    </span>{" "}
                    approved employees
                  </p>
                  <div className="flex gap-1 items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={safeCurrentPage === 1 || isLoadingApprovals}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-[#0c244c] transition-all hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Prev
                    </button>
                    {getPageNumbers(safeCurrentPage, totalPages).map(
                      (page, idx) =>
                        typeof page === "number" ? (
                          <button
                            type="button"
                            key={`page-${page}`}
                            onClick={() => setCurrentPage(page)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition-all ${
                              safeCurrentPage === page
                                ? "bg-[#0084c8] text-white shadow-sm"
                                : "border border-gray-200 bg-white text-[#0c244c] hover:bg-gray-100"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span
                            key={`ellipsis-${idx}`}
                            className="inline-flex h-8 w-8 items-center justify-center text-gray-400 text-xs font-bold"
                          >
                            {page}
                          </span>
                        )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(p + 1, totalPages))
                      }
                      disabled={
                        safeCurrentPage === totalPages || isLoadingApprovals
                      }
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

export default function ExitApprovalPage() {
  return (
    <PermissionGuard permission="exitApproval">
      <ExitApprovalPageContent />
    </PermissionGuard>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-lg font-medium text-[#2d3748] mb-2 ml-1">
      {label}
    </label>
  );
}
