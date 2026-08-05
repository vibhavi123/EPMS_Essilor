"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import RecordVerificationModal from "@/components/RecordVerificationModal";
import OverdueEmployeeAlert from "@/components/OverdueEmployeeAlert";
import { GateRecordRow, EmployeeData } from "@/utils/formTypes";
import { searchEmployees } from "@/lib/api/employees";
import {
  User, Briefcase, Scan, ArrowRightLeft, UserCheck,
  Truck, RefreshCw, AlertCircle, CheckCircle,
} from "lucide-react";
import { PermissionGuard } from "@/hooks/usePermissions";

// Toast Notification 
interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let _toastId = 0;

export default function GateControlPage() {
  const [mode, setMode] = useState<"employee" | "visitor" | "vehicle">("employee");
  const [idInput, setIdInput] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [reason, setReason] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleType, setVehicleType] = useState("Van");
  const [plateNumber, setPlateNumber] = useState("");
  const [exitReason, setExitReason] = useState("");

  const [activeRecords, setActiveRecords] = useState<GateRecordRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const [verificationRecord, setVerificationRecord] = useState<GateRecordRow | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [isSearchingEmployee, setIsSearchingEmployee] = useState(false);
  const [overdueHours, setOverdueHours] = useState<number | null>(null);

  // Fetch overdue hours threshold
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/overdue');
        const data = await res.json();
        if (data?.success && data.value) {
          const val = parseInt(String(data.value), 10);
          if (!Number.isNaN(val) && val > 0) {
            setOverdueHours(val);
          }
        }
      } catch {
        // silent fail
      }
    })();
  }, []);

  // Check if a record is overdue using entry time
  const isRecordOverdue = (record: GateRecordRow): boolean => {
    if (!overdueHours || !record.entryTime || record.exitTime) return false;
    
    // Parse entry time (format: "HH:MM AM/PM")
    const timeMatch = record.entryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return false;
    
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    // Create a date object for today with entry time
    const entryDate = new Date();
    entryDate.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    const diffHours = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= overdueHours;
  };

  //  Toast helpers 
  const showToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  //  Fetch active records 
  const fetchActiveRecords = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch("/api/gate-records");
      const data = await res.json();
      if (data.success) {
        setActiveRecords(data.data as GateRecordRow[]);
      } else {
        showToast(data.message || "Failed to load active records", "error");
      }
    } catch {
      showToast("Network error: could not load active records", "error");
    } finally {
      setIsLoadingList(false);
    }
  }, [showToast]);

  // Search for employee by ID 
  const searchEmployeeById = useCallback(async (employeeId: string) => {
    if (!employeeId.trim()) {
      setSelectedEmployee(null);
      return;
    }

    setIsSearchingEmployee(true);
    try {
      const results = await searchEmployees(employeeId, 10);
      if (results.length > 0) {
        // Find exact match by employeeId or take first result
        const employee = results.find((e) => e.employeeId === employeeId.trim()) || results[0];
        setSelectedEmployee(employee);
      } else {
        setSelectedEmployee(null);
        showToast(`Employee ID "${employeeId}" not found in database`, "error");
      }
    } catch (err) {
      // Error is intentionally ignored - using fallback behavior
      void err;
      setSelectedEmployee(null);
      showToast("Error searching for employee", "error");
    } finally {
      setIsSearchingEmployee(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchActiveRecords();
  }, [fetchActiveRecords]);

  //  Handle entry / recording 
  const handleRecordEntry = async () => {
    if (mode !== "vehicle" && !idInput.trim()) return;
    if (mode === "vehicle" && !plateNumber.trim()) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString();

    let personnelId = "";
    let name = "";
    let visitorReason = "";
    let employeeCompany = "";
    let employeeDepartment = "";

    if (mode === "employee") {
      if (!selectedEmployee) {
        showToast("Employee not found. Please scan a valid employee ID.", "error");
        return;
      }
      personnelId = selectedEmployee.employeeId;
      name = selectedEmployee.employeeName;
      employeeCompany = selectedEmployee.employeeCompany || "";
      employeeDepartment = selectedEmployee.department || "";
      visitorReason = "";
    } else if (mode === "visitor") {
      personnelId = idInput.trim() || `V-${Date.now()}`;
      name = visitorName.trim() || "Visitor";
      visitorReason = reason.trim() || "General Visit";
    } else {
      personnelId = plateNumber.trim();
      name = driverName.trim() || "Driver";
      visitorReason = "";
    }

    setIsSubmitting(true);
    try {
      const payload = {
        personnelId,
        name,
        visitorReason,
        type: mode,
        entryTime: time,
        date,
        driverName: mode === "vehicle" ? driverName.trim() || null : null,
        vehicleType: mode === "vehicle" ? vehicleType : null,
        plateNumber: mode === "vehicle" ? plateNumber.trim() : null,
        vehicleArrivalReason: mode === "vehicle" ? reason.trim() || null : null,
        employeeCompany: mode === "employee" ? employeeCompany : null,
        employeeDepartment: mode === "employee" ? employeeDepartment : null,
        employeeExitReason: mode === "employee" ? exitReason.trim() || null : null,
      };

      const res = await fetch("/api/gate-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showToast(
          mode === "employee"
            ? "Exit recorded — employee is now outside"
            : mode === "visitor"
            ? "Visitor entry recorded"
            : "Vehicle entry recorded",
          "success"
        );
        // Reset inputs
                setIdInput("");
        setVisitorName("");
        setReason("");
                setExitReason("");
        setDriverName("");
        setVehicleType("Van");
        setPlateNumber("");
        setSelectedEmployee(null);
        // Refresh list
        fetchActiveRecords();
      } else {
        showToast(data.message || "Failed to record entry", "error");
      }
    } catch {
      showToast("Network error: failed to record entry", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle return / exit 
  const handleRecordReturn = (record: GateRecordRow) => {
    setVerificationRecord(record);
  };

  const handleConfirmReturn = async (guardId: string) => {
    if (!verificationRecord) return;

    const exitTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setIsExiting(true);
    try {
      const res = await fetch("/api/gate-records/exit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: verificationRecord.id, exitTime, guardId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(
          mode === "employee" ? "Return recorded successfully" : "Exit recorded successfully",
          "success"
        );
        setVerificationRecord(null);
        fetchActiveRecords();
      } else {
        showToast(data.message || "Failed to record exit", "error");
      }
    } catch {
      showToast("Network error: failed to record exit", "error");
    } finally {
      setIsExiting(false);
    }
  };

  // Filtered list for active mode 
  const filteredList = activeRecords.filter((r) => r.type === mode);

  // Build a legacy-compatible record for the modal 
  const modalRecord = verificationRecord
    ? {
        id: verificationRecord.personnelId,
        name: verificationRecord.name ?? verificationRecord.personnelId,
        visitorReason: verificationRecord.visitorReason ?? "",
        entryTime: verificationRecord.entryTime,
        type: verificationRecord.type,
        date: verificationRecord.date,
        details:
          verificationRecord.type === "vehicle"
            ? {
                driverName: verificationRecord.driverName ?? undefined,
                vehicleType: verificationRecord.vehicleType ?? undefined,
                plateNumber: verificationRecord.plateNumber ?? undefined,
              }
            : undefined,
      }
    : null;

  return (
    <PermissionGuard permission="entryExitRecording">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        {/* Toast Container  */}
        <div className="fixed top-5 right-5 z-100 space-y-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white pointer-events-auto transition-all animate-in slide-in-from-right-4 ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </div>
        ))}
      </div>

      <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all">

        {/* Header  */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">Gate Control</h1>
              <p className="text-sm text-gray-600 mt-1">Manage personnel entry and exit security</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <DateTime />
            <div className="flex gap-2">
              <button
                onClick={fetchActiveRecords}
                disabled={isLoadingList}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60"
              >
                <RefreshCw size={14} className={isLoadingList ? "animate-spin" : ""} />
                Refresh
              </button>
              <Link
                href="/pages/AllEntryExitRecords"
                className="flex items-center gap-2 px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
              >
                View History
              </Link>
            </div>
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">

          {/* LEFT: Entry Form  */}
          <div className="xl:col-span-4 space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-[#4a5568] mb-6 flex items-center gap-2">
                <Scan size={20} className="text-blue-500" />
                {mode === "employee"
                  ? "Recording Exit"
                  : mode === "visitor"
                  ? "Recording Visitor Entry"
                  : "Recording Vehicle Entry"}
              </h2>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                {/* Mode Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                  {(["employee", "visitor", "vehicle"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                        mode === m ? "bg-white text-[#0c244c] shadow-sm" : "text-gray-500"
                      }`}
                    >
                      {m === "employee" ? <User size={18} /> : m === "visitor" ? <Briefcase size={18} /> : <Truck size={18} />}
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Inputs */}
                <div className="space-y-4">
                  {mode === "visitor" && (
                    <>
                      <div>
                        <InputLabel label="Visitor Name" />
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                          value={visitorName}
                          onChange={(e) => setVisitorName(e.target.value)}
                          placeholder="Full name (optional)"
                        />
                      </div>
                      <div>
                        <InputLabel label="Reason for Visit" />
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Maintenance (optional)"
                        />
                      </div>
                    </>
                  )}

                  {mode === "vehicle" && (
                    <>
                      <div>
                        <InputLabel label="Vehicle Type *" />
                        <select
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                        >
                          <option value="Van">Van</option>
                          <option value="Truck">Truck</option>
                          <option value="Car">Car</option>
                          <option value="Motorcycle">Motorcycle</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <InputLabel label="License Plate *" />
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-mono uppercase"
                          value={plateNumber}
                          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                          placeholder="e.g. ABC-1234"
                        />
                      </div>
                      <div>
                        <InputLabel label="Driver Name" />
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Driver name (optional)"
                        />
                      </div>
                      <div>
                        <InputLabel label="Reason (optional)" />
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Purpose of visit / delivery (optional)"
                        />
                      </div>
                    </>
                  )}

                  {mode !== "vehicle" && (
                    <div className="space-y-4">
                      <div>
                        <InputLabel label={mode === "employee" ? "Scan Employee ID *" : "Scan ID Card / Entry ID *"} />
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-lg text-center"
                            value={idInput}
                            onChange={(e) => {
                              setIdInput(e.target.value);
                              if (mode === "employee") {
                                searchEmployeeById(e.target.value);
                              }
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleRecordEntry()}
                            placeholder="Scan now..."
                          />
                          <Scan className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                        </div><br></br>
                      {mode === "employee" && (
                        <div>
                          <InputLabel label="Reason for Exit *" />
                          <input
                            type="text"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                            value={exitReason}
                            onChange={(e) => setExitReason(e.target.value)}
                            placeholder="e.g. End of work, Field visit (required)"
                          />
                        </div>
                      )}
                      </div>

                      {mode === "employee" && isSearchingEmployee && (
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                          Searching employee...
                        </div>
                      )}

                      {mode === "employee" && selectedEmployee && !isSearchingEmployee && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 text-sm">
                          <div><span className="text-gray-600">Name:</span> <span className="font-semibold">{selectedEmployee.employeeName}</span></div>
                          {selectedEmployee.employeeCompany && <div><span className="text-gray-600">Company:</span> <span className="font-semibold">{selectedEmployee.employeeCompany}</span></div>}
                          {selectedEmployee.department && <div><span className="text-gray-600">Department:</span> <span className="font-semibold">{selectedEmployee.department}</span></div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRecordEntry}
                  disabled={
                    isSubmitting ||
                    (mode !== "vehicle" && !idInput.trim()) ||
                      (mode === "vehicle" && !plateNumber.trim()) ||
                      (mode === "employee" && !exitReason.trim())
                  }
                  className="w-full bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? "Recording..."
                    : mode === "employee"
                    ? "Confirm Exit"
                    : mode === "visitor"
                    ? "Record Visitor Entry"
                    : "Record Vehicle Entry"}
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT: Active Records List  */}
          <div className="xl:col-span-8">
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-[#4a5568] flex items-center gap-2">
                  <ArrowRightLeft size={20} className="text-blue-500" />
                  {mode === "employee" ? "Currently Outside" : "Currently On Premise"}
                </h2>
                <span
                  className={`px-4 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                    mode === "employee"
                      ? "bg-[#e2f9ec] text-[#34d399]"
                      : mode === "vehicle"
                      ? "bg-[#dbeafe] text-[#0284c7]"
                      : "bg-[#fef3c7] text-[#f59e0b]"
                  }`}
                >
                  {mode}s: {filteredList.length}
                </span>
              </div>

              {/* Table Headers */}
              <div className="hidden lg:grid grid-cols-12 gap-2 px-8 mb-4 text-[#f87171] font-bold text-xs uppercase tracking-widest">
                <div className="col-span-6">Name / Reason</div>
                <div className="col-span-3 text-center">Departure</div>
                <div className="col-span-3 text-right">Action</div>
              </div>

              {isLoadingList ? (
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl py-20 flex flex-col items-center text-gray-300 gap-3">
                  <RefreshCw size={40} className="animate-spin opacity-30" />
                  <p className="font-bold">Loading records…</p>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl py-20 flex flex-col items-center text-gray-300">
                  <UserCheck size={48} className="mb-2 opacity-20" />
                  <p className="font-bold">No {mode}s currently recorded as outside</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredList.map((record) => (
                    <div
                      key={record.id}
                      className="bg-white border border-[#6366f1]/30 rounded-2xl shadow-sm hover:border-[#6366f1] transition-all"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center px-8 py-5 text-[#2d3748] font-semibold text-sm">
                        <div className="col-span-6">
                          <p className="font-bold text-[#0c244c]">
                            {record.name ?? record.personnelId}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-tight">
                            {record.type === "vehicle" ? record.vehicleType ?? "" : ""}
                          </p>
                          {/* Reason display: employee exit reason or vehicle arrival reason or visitor reason */}
                          {record.type === "employee" && record.employeeExitReason && (
                            <p className="text-[11px] text-gray-500 mt-1">Reason: {record.employeeExitReason}</p>
                          )}
                          {record.type === "vehicle" && record.vehicleArrivalReason && (
                            <p className="text-[11px] text-gray-500 mt-1">Reason: {record.vehicleArrivalReason}</p>
                          )}
                          {record.type === "visitor" && record.visitorReason && (
                            <p className="text-[11px] text-gray-500 mt-1">Reason: {record.visitorReason}</p>
                          )}
                        </div>

                        <div className="col-span-3 text-center">
                          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md font-bold">
                            {record.entryTime}
                          </span>
                        </div>

                        <div className="col-span-3 flex justify-end">
                          {mode === "employee" && isRecordOverdue(record) ? (
                            <div className="group relative">
                              <button
                                disabled
                                title="This employee is overdue. Only admin can confirm return via alert."
                                className="bg-gray-400 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm cursor-not-allowed opacity-75"
                              >
                                Return Locked
                              </button>
                              <div className="hidden group-hover:block absolute right-0 bottom-full mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 z-50 whitespace-normal">
                                <p>✓ This employee is overdue</p>
                                <p>✓ Only Admin/SuperAdmin can confirm return</p>
                                <p>✓ Look for the alert notification</p>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRecordReturn(record)}
                              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                            >
                              {mode === "employee" ? "Mark Return" : "Mark Exit"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <RecordVerificationModal
        isOpen={verificationRecord !== null}
        onClose={() => setVerificationRecord(null)}
        onConfirm={handleConfirmReturn}
        record={modalRecord}
        mode={mode}
        isSubmitting={isExiting}
      />
      <OverdueEmployeeAlert />
      </div>
    </PermissionGuard>
  );
  
}

function InputLabel({ label }: { label: string }) {
  return (
    <label className="block text-sm font-bold text-[#4a5568] mb-2 ml-1 uppercase tracking-wide">
      {label}
    </label>
  );
}
