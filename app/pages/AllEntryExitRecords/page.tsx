"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import OverdueEmployeeAlert from "@/components/OverdueEmployeeAlert";
import { GateRecordRow } from "@/utils/formTypes";
import { Search, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { PermissionGuard, usePermissions } from "@/hooks/usePermissions";

export default function AllEntryExitRecordsPage() {
  const { hasPermission } = usePermissions();
  
  // Escape values for CSV cells
  function escapeCsv(input?: string | number | null) {
    if (input === null || input === undefined) return "";
    const s = String(input);
    const escaped = s.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  // Keep ID-style values as text when opened in Excel so NICs do not become scientific notation.
  function escapeCsvText(input?: string | number | null) {
    if (input === null || input === undefined) return "";
    const s = String(input).replace(/"/g, '""');
    return `="${s}"`;
  }
  const [records, setRecords] = useState<GateRecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "employee" | "visitor" | "vehicle">("all");

  //Fetch all records from DB 
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/gate-records/list?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setRecords(data.data as GateRecordRow[]);
      } else {
        setError(data.message || "Failed to load records");
      }
    } catch {
      setError("Network error: could not load gate records");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, searchQuery]);

  // Debounced search — only re-fetch after typing stops for 400 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchRecords]);

  // Client-side derived stats 
  const stats = useMemo(() => ({
    total:       records.length,
    employees:   records.filter((r) => r.type === "employee").length,
    visitors:    records.filter((r) => r.type === "visitor").length,
    vehicles:    records.filter((r) => r.type === "vehicle").length,
    onPremise:   records.filter((r) => !r.exitTime).length,
  }), [records]);

  return (
    <PermissionGuard permission="entryExitRecording">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">

          {/* Header*/}
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
              <Link
                href="/pages/EntryExitRecording"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
              >
                <ArrowLeft size={18} />
              </Link>
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Logs</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">Entry &amp; Exit Records</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchRecords}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (typeFilter !== "all") params.set("type", typeFilter);
                  if (searchQuery.trim()) params.set("search", searchQuery.trim());
                  const res = await fetch(`/api/gate-records/list?${params.toString()}`);
                  const json = await res.json();
                  if (!json.success) throw new Error(json.message || "Failed to fetch records");
                  const rows = json.data as GateRecordRow[];
                  const headers = [
                    "Id",
                    "PersonnelId",
                    "Name",
                    "Type",
                    "VisitorReason",
                    "PlateNumber",
                    "VehicleType",
                    "DriverName",
                    "VehicleArrivalReason",
                    "EmployeeExitReason",
                    "EmployeeCompany",
                    "EmployeeDepartment",
                    "EntryTime",
                    "ExitTime",
                    "Date",
                    "VerificationType",
                    "GuardId",
                    "GuardVerifiedAt",
                    "CreatedAt",
                  ];

                  const csvRows = [headers.join(",")];
                  for (const r of rows) {
                    // Determine verification type and guardId display
                    let verificationType = "Not Returned";
                    let guardIdDisplay = r.guardId ?? "";
                    
                    if (r.exitTime) {
                      if (!r.guardVerifiedAt) {
                        verificationType = "Admin Confirmed";
                        guardIdDisplay = ""; // Hide guardId for admin confirmations
                      } else {
                        verificationType = "Guard Verified";
                      }
                    }

                    const vals = [
                      r.id ?? "",
                      escapeCsvText(r.personnelId),
                      escapeCsv(r.name ?? ""),
                      r.type ?? "",
                      escapeCsv(r.visitorReason ?? ""),
                      escapeCsv(r.plateNumber ?? ""),
                      escapeCsv(r.vehicleType ?? ""),
                      escapeCsv(r.driverName ?? ""),
                      escapeCsv(r.vehicleArrivalReason ?? ""),
                      escapeCsv(r.employeeExitReason ?? ""),
                      escapeCsv(r.employeeCompany ?? ""),
                      escapeCsv(r.employeeDepartment ?? ""),
                      r.entryTime ?? "",
                      r.exitTime ?? "",
                      r.date ?? "",
                      verificationType,
                      guardIdDisplay,
                      r.guardVerifiedAt ?? "",
                      r.createdAt ?? "",
                    ];
                    csvRows.push(vals.join(","));
                  }

                  const csv = csvRows.join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `gate-records-${typeFilter}-${Date.now()}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  void err;
                  alert("Failed to export CSV");
                }
              }}
              disabled={!hasPermission("allEntryExitRecordsExport")}
              title={!hasPermission("allEntryExitRecordsExport") ? "You don't have permission to export CSV" : "Export records to CSV"}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-200 mb-8" />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatBox label="Total Records"   value={stats.total}     color="blue" />
          <StatBox label="Employees"       value={stats.employees} color="green" />
          <StatBox label="Visitors"        value={stats.visitors}  color="yellow" />
          <StatBox label="Vehicles"        value={stats.vehicles}  color="purple" />
          <StatBox
            label="Still On Premise"
            value={stats.onPremise}
            color="red"
            notify={stats.onPremise > 0}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by ID, Name, Reason, Category or Plate…"
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "all" | "employee" | "visitor" | "vehicle")
            }
            className="px-4 py-2 bg-white border border-gray-100 rounded-lg shadow-sm text-sm font-bold text-[#2d3748] outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="employee">Employees</option>
            <option value="visitor">Visitors</option>
            <option value="vehicle">Vehicles</option>
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-6 text-sm font-semibold">
            <AlertCircle size={20} className="shrink-0" />
            {error}
            <button
              onClick={fetchRecords}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table Headers */}
        {!isLoading && !error && records.length > 0 && (
          <div className="hidden lg:grid grid-cols-12 gap-2 px-8 mb-4 text-[#f87171] font-bold text-sm uppercase tracking-wider">
            <div className="col-span-2">ID / Plate</div>
            <div className="col-span-3">Name / Reason</div>
            <div className="col-span-2 text-center">Type</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-4 text-center">Date &amp; Time Log</div>
          </div>
        )}

        {/* Records List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-20 text-center">
              <RefreshCw size={36} className="animate-spin text-blue-300 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">Loading records…</p>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-20 text-center text-gray-400 font-bold">
              No records found matching your criteria
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="bg-white border border-[#6366f1]/30 rounded-2xl shadow-sm hover:border-[#6366f1] transition-all group"
              >
                {/* Desktop Row */}
                <div className="hidden lg:grid grid-cols-12 gap-2 items-center px-8 py-5 text-[#2d3748] font-semibold text-sm">
                  {record.type !== "employee" ? (
                    <div className="col-span-2 font-mono text-xs text-gray-500">
                      {record.personnelId}
                    </div>
                  ) : null}

                  <div className={record.type === "employee" ? "col-span-5" : "col-span-3"}>
                      <p className="font-bold">
                        {record.type === "vehicle"
                          ? record.driverName ?? record.name ?? "N/A"
                          : record.name ?? record.personnelId}
                      </p>
                    {/* Type-specific details */}
                    {record.type === "employee" && (
                      <>
                        {(record.employeeCompany || record.employeeDepartment) && (
                          <p className="text-[10px] text-gray-400">{record.employeeCompany} / {record.employeeDepartment}</p>
                        )}
                        {record.employeeExitReason && (
                          <p className="text-[11px] text-gray-500 mt-1">Reason: {record.employeeExitReason}</p>
                        )}
                      </>
                    )}
                    {record.type === "visitor" && (
                      <>
                        {record.visitorReason && (
                          <p className="text-[11px] text-gray-500 mt-1">Reason: {record.visitorReason}</p>
                        )}
                        {!record.visitorReason && (
                          <p className="text-[11px] text-gray-400 italic">No reason provided</p>
                        )}
                      </>
                    )}
                    {record.type === "vehicle" && (
                      <>
                        <p className="text-[10px] text-gray-400">
                          {record.vehicleType && <span>{record.vehicleType}</span>}
                          {record.plateNumber && <span> • {record.plateNumber}</span>}
                        </p>
                        {record.vehicleArrivalReason && (
                          <p className="text-[11px] text-gray-500 mt-1">Reason: {record.vehicleArrivalReason}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <span
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        record.type === "employee"
                          ? "bg-[#e2f9ec] text-[#34d399]"
                          : record.type === "visitor"
                          ? "bg-[#fef3c7] text-[#f59e0b]"
                          : "bg-[#dbeafe] text-[#0284c7]"
                      }`}
                    >
                      {record.type}
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    {record.exitTime && !record.guardVerifiedAt ? (
                      <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700" title="Confirmed by Admin">
                        ✓ Admin
                      </span>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-md text-[10px] font-bold ${
                          record.exitTime
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-600"
                        }`}
                      >
                        {record.type === "employee"
                          ? record.exitTime
                            ? "Returned"
                            : "Still Outside"
                          : record.exitTime
                          ? "Exited"
                          : "On Premise"}
                      </span>
                    )}
                  </div>

                  <div className="col-span-4 text-center text-xs">
                    <span className="text-gray-400 mr-2">{record.date}</span>
                    <span className="font-bold">{record.entryTime}</span>
                    <span className="mx-2 text-gray-300">→</span>
                    <span
                      className={
                        record.exitTime
                          ? "font-bold text-green-600"
                          : "font-bold text-red-500"
                      }
                    >
                      {record.exitTime ?? "—"}
                    </span>
                    {record.guardId && record.guardVerifiedAt && (
                      <span className="ml-3 text-[10px] text-gray-400 font-mono">
                        Guard: {record.guardId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Card */}
                <div className="lg:hidden p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    {record.type !== "employee" ? (
                      <span className="font-black text-[#0c244c] tracking-tighter font-mono">
                        {record.personnelId}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                        record.type === "employee"
                          ? "bg-[#e2f9ec] text-[#34d399]"
                          : record.type === "visitor"
                          ? "bg-[#fef3c7] text-[#f59e0b]"
                          : "bg-[#dbeafe] text-[#0284c7]"
                      }`}
                    >
                      {record.type}
                    </span>
                  </div>
                  <div className="text-sm font-bold">
                    {record.type === "vehicle"
                      ? record.driverName ?? record.name ?? "N/A"
                      : record.name ?? record.personnelId}
                  </div>
                  {/* Type-specific details for mobile */}
                  {record.type === "employee" && (
                    <>
                      {(record.employeeCompany || record.employeeDepartment) && (
                        <div className="text-xs text-gray-400">{record.employeeCompany} / {record.employeeDepartment}</div>
                      )}
                      {record.employeeExitReason && (
                        <div className="text-xs text-gray-500">Reason: {record.employeeExitReason}</div>
                      )}
                    </>
                  )}
                  {record.type === "visitor" && (
                    <>
                      {record.visitorReason && (
                        <div className="text-xs text-gray-500">Reason: {record.visitorReason}</div>
                      )}
                      {!record.visitorReason && (
                        <div className="text-xs text-gray-400 italic">No reason provided</div>
                      )}
                    </>
                  )}
                  {record.type === "vehicle" && (
                    <>
                      <div className="text-xs text-gray-400">
                        {record.vehicleType && <span>{record.vehicleType}</span>}
                        {record.plateNumber && <span> • {record.plateNumber}</span>}
                      </div>
                      {record.vehicleArrivalReason && (
                        <div className="text-xs text-gray-500">Reason: {record.vehicleArrivalReason}</div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>
                      {record.date} &nbsp;|&nbsp; {record.entryTime} → {record.exitTime ?? "—"}
                    </span>
                    <span
                      className={record.exitTime ? "text-green-600 font-bold" : "text-orange-600 font-bold"}
                    >
                      {record.type === "employee"
                        ? record.exitTime ? "Returned" : "Still Outside"
                        : record.exitTime ? "Exited" : "On Premise"}
                    </span>
                  </div>
                  {record.guardId && record.guardVerifiedAt && (
                    <div className="text-[10px] text-gray-400 font-mono">
                      Guard: {record.guardId}
                    </div>
                  )}
                  {record.exitTime && !record.guardVerifiedAt && (
                    <div className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded px-2 py-1 w-fit" title="Confirmed by Admin">
                      ✓ Admin Confirmed
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        {!isLoading && records.length > 0 && (
          <p className="text-center text-xs text-gray-400 font-semibold mt-8">
            Showing {records.length} record{records.length !== 1 ? "s" : ""}
          </p>
        )}
        </main>

        {/* Overdue Employee Alert */}
        <OverdueEmployeeAlert />
      </div>
    </PermissionGuard>
  );
}

// Stat Box Component
function StatBox({
  label, value, color, notify,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "red" | "purple";
  notify?: boolean;
}) {
  const colorMap: Record<typeof color, string> = {
    blue:   "border-blue-100",
    green:  "border-green-100",
    yellow: "border-yellow-100",
    red:    "border-red-300",
    purple: "border-indigo-100",
  };

  return (
    <div className={`bg-white border ${colorMap[color]} p-5 rounded-2xl shadow-sm relative`}>
      {notify && (
        <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0c244c]">{value}</p>
    </div>
  );
}