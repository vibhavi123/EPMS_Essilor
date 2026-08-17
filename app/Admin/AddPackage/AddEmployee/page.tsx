"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import EmployeeBarcodePrintCard from "@/components/EmployeeBarcodePrintCard";
import { fetchNextEmployeeId } from "@/utils/idSequenceClient";
import { X, Upload, ArrowLeft, Printer, UsersRound, AlertTriangle, CheckCircle2, Loader2, Plus, Search, Trash2 } from "lucide-react";

type EmployeeRecord = {
  id?: number;
  employeeId: string;
  employeeName: string;
  employeeCompany: string | null;
  department: string | null;
  createdAt?: string;
};

export default function AddEmployeePage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  const [employeeData, setEmployeeData] = useState({
    employeeName: "",
    employeeCompany: "",
    department: "",
  });

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<EmployeeRecord[]>([]);
  const nameContainerRef = useRef<HTMLDivElement>(null);

  const [generatedEmployeeId, setGeneratedEmployeeId] = useState<string | null>(null);
  const [generatedEmployee, setGeneratedEmployee] = useState<{
    employeeId: string;
    employeeName: string;
    employeeCompany: string;
    department: string;
  } | null>(null);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [activeEmployeeSearch, setActiveEmployeeSearch] = useState("");
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeRecord | null>(null);
  const [selectedEmployeeFromList, setSelectedEmployeeFromList] = useState<EmployeeRecord | null>(null);
  const [currentEmployeePage, setCurrentEmployeePage] = useState(1);
  const employeesPerPage = 10;

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAddPackage();
          return;
        }

        const canAccessEmployeeSection = Boolean(data?.data?.permissions?.addPackageEmployee);
        if (!canAccessEmployeeSection) {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEmployeeId = async () => {
    try {
      const newId = await fetchNextEmployeeId();
      setGeneratedEmployeeId(newId);
    } catch {
      setGeneratedEmployeeId(null);
    }
  };

  useEffect(() => {
    void loadEmployeeId();
  }, []);

  const fetchEmployees = async (search = "") => {
    setEmployeesLoading(true);
    setEmployeesError("");
    setCurrentEmployeePage(1);

    try {
      const params = new URLSearchParams({ limit: "500" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/employees?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load employees");
      }

      const employeesList = Array.isArray(data.data) ? data.data : [];
      employeesList.sort((a: EmployeeRecord, b: EmployeeRecord) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setEmployees(employeesList);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load employees";
      setEmployeesError(message);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  const handleEmployeeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveEmployeeSearch(employeeSearchQuery.trim());
    await fetchEmployees(employeeSearchQuery);
  };

  const handleEmployeeSearchClear = async () => {
    setEmployeeSearchQuery("");
    setActiveEmployeeSearch("");
    await fetchEmployees("");
  };

  const handleDeleteEmployee = async (employee: EmployeeRecord) => {
    setEmployeeToDelete(employee);
  };

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) {
      return;
    }

    const employeeIdentifier = employeeToDelete.id?.toString() || employeeToDelete.employeeId;

    setDeletingEmployeeId(employeeIdentifier);
    setEmployeesError("");

    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employeeIdentifier)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete employee");
      }

      await fetchEmployees(activeEmployeeSearch || employeeSearchQuery);

      if (generatedEmployee?.employeeId === employeeToDelete.employeeId) {
        setGeneratedEmployee(null);
        setSuccess("");
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete employee";
      setEmployeesError(message);
    } finally {
      setDeletingEmployeeId(null);
      setEmployeeToDelete(null);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        nameContainerRef.current &&
        !nameContainerRef.current.contains(event.target as Node)
      ) {
        setShowNameSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setEmployeeData((prev) => ({ ...prev, employeeName: query }));
    if (error) setError("");

    if (query.trim().length >= 1) {
      const q = query.trim().toLowerCase();
      const filtered = employees.filter((emp) =>
        emp.employeeName.toLowerCase().includes(q)
      );
      setNameSuggestions(filtered.slice(0, 8));
      setShowNameSuggestions(true);
    } else {
      setNameSuggestions([]);
      setShowNameSuggestions(false);
    }
  };

  const selectEmployeeSuggestion = (emp: EmployeeRecord) => {
    setEmployeeData({
      employeeName: emp.employeeName,
      employeeCompany: emp.employeeCompany || "",
      department: emp.department || "",
    });
    setShowNameSuggestions(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof typeof employeeData
  ) => {
    setEmployeeData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!employeeData.employeeName.trim()) {
      setError("Employee name is required");
      setLoading(false);
      return;
    }
    if (!employeeData.employeeCompany.trim()) {
      setError("Employee company is required");
      setLoading(false);
      return;
    }
    if (!employeeData.department.trim()) {
      setError("Employee department is required");
      setLoading(false);
      return;
    }

    try {
      const employeeId = generatedEmployeeId || "";

      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          employeeName: employeeData.employeeName.trim(),
          employeeCompany: employeeData.employeeCompany.trim(),
          department: employeeData.department.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save employee");
      }

      setSuccess("Employee added successfully!");
      setGeneratedEmployee({
        employeeId,
        employeeName: employeeData.employeeName.trim(),
        employeeCompany: employeeData.employeeCompany.trim(),
        department: employeeData.department.trim(),
      });

      await fetchEmployees();

      setEmployeeData({
        employeeName: "",
        employeeCompany: "",
        department: "",
      });
      await loadEmployeeId();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnother = () => {
    setGeneratedEmployee(null);
    setSuccess("");
  };

  // Pagination Logic
  const totalEmployees = employees.length;
  const totalPages = Math.ceil(totalEmployees / employeesPerPage);
  const startIndex = (currentEmployeePage - 1) * employeesPerPage;
  const endIndex = startIndex + employeesPerPage;
  const paginatedEmployees = employees.slice(startIndex, endIndex);

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

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-rise">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Employee Information Management</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => nav.goToAddPackage()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] transition-all">
              <ArrowLeft className="size-4" /> Back to Hub
            </button>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-6 w-full">
          
          {/* LEFT: Form card */}
          <section className="surface-card p-6 animate-rise">
            {generatedEmployee ? (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-navy">Employee added</h2>
                <div className="surface-card space-y-3 p-5 text-center shadow-lift">
                  <h3 className="text-lg font-extrabold text-navy">{generatedEmployee.employeeName}</h3>
                  <p className="font-mono text-[13px] font-bold text-primary">{generatedEmployee.employeeId}</p>
                  <p className="text-[13px] text-muted-foreground">{generatedEmployee.employeeCompany} · {generatedEmployee.department}</p>
                  <EmployeeBarcodePrintCard
                    employee={generatedEmployee}
                    onAddAnother={handleAddAnother}
                  />
                </div>
                <div className="flex flex-wrap gap-2 print-hide">
                  <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm border border-border bg-card text-navy hover:border-primary/50 active:scale-95 transition-all">
                    <Printer className="size-4" /> Print
                  </button>
                  <button onClick={handleAddAnother} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97]">
                    <Plus className="size-4" /> Add Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-base font-bold text-navy">Add Employee</h2>
                
                {/* Employee ID read-only */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Employee ID</label>
                  <div className="flex h-11 items-center rounded-lg border border-dashed border-primary/40 bg-primary/6 px-3 font-mono text-sm font-bold text-navy">{generatedEmployeeId ?? 'Generating...'}</div>
                  <p className="text-[12px] text-muted-foreground">Auto-generated — read only.</p>
                </div>

                {/* Name with autocomplete */}
                <div className="relative space-y-1.5" ref={nameContainerRef}>
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Employee Name *</label>
                  <input
                    type="text"
                    value={employeeData.employeeName}
                    onChange={handleNameInputChange}
                    onFocus={() => {
                      if (employeeData.employeeName.trim().length >= 1) {
                        const q = employeeData.employeeName.trim().toLowerCase();
                        const filtered = employees.filter((emp) =>
                          emp.employeeName.toLowerCase().includes(q)
                        );
                        setNameSuggestions(filtered.slice(0, 8));
                        setShowNameSuggestions(true);
                      }
                    }}
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter employee name"
                    autoComplete="off"
                  />
                  {/* autocomplete dropdown */}
                  {showNameSuggestions && nameSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lift animate-rise">
                      {nameSuggestions.map(s => (
                        <li key={s.id ?? s.employeeId}>
                          <button type="button" onClick={() => selectEmployeeSuggestion(s)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary">
                            <span className="font-medium text-navy">{s.employeeName}</span>
                            <span className="font-mono text-[12px] text-muted-foreground">{s.employeeId}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Company *</label>
                  <input
                    type="text"
                    value={employeeData.employeeCompany}
                    onChange={(e) => handleChange(e, "employeeCompany")}
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter company name"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Department *</label>
                  <input
                    type="text"
                    value={employeeData.department}
                    onChange={(e) => handleChange(e, "department")}
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter department"
                  />
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none">
                    {loading ? <><Loader2 className="size-4 animate-spin" /> Adding...</> : 'Add Employee'}
                  </button>
                  <button type="button" onClick={() => nav.goToImportEmployees()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-45">
                    <Upload className="size-4" /> Import via CSV
                  </button>
                </div>

                {/* Error & Success*/}
                {error && <p className="flex items-center gap-1 text-[12px] font-medium text-destructive animate-rise"><AlertTriangle className="size-3.5" /> {error}</p>}
                {success && <p className="flex items-center gap-1 text-[12px] font-medium text-green-600 animate-rise"><CheckCircle2 className="size-3.5" /> {success}</p>}
              </form>
            )}
          </section>

          {/* RIGHT: Employee list card */}
          <section className="surface-card overflow-hidden animate-rise print-hide">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <form onSubmit={handleEmployeeSearch}>
                  <input
                    type="text"
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    placeholder="Search by Employee ID or name"
                    className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                  {/* Hidden submit button to allow enter to submit form */}
                  <button type="submit" className="hidden"></button>
                </form>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleEmployeeSearch} disabled={employeesLoading} className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-3 text-[13px] bg-gradient-brand text-white active:scale-[0.97] disabled:opacity-50">Search</button>
                <button type="button" onClick={() => void handleEmployeeSearchClear()} disabled={employeesLoading || (!employeeSearchQuery && !activeEmployeeSearch)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-3 text-[13px] bg-secondary text-navy border border-border hover:bg-accent active:scale-[0.97] disabled:opacity-50"><X className="size-4" /> Clear</button>
              </div>
            </div>

            {employeesError && (
              <div className="p-4 border-b border-border bg-destructive/5 text-sm text-destructive font-medium">
                {employeesError}
              </div>
            )}

            {employeesLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                Loading employee records...
              </div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <UsersRound className="size-8 text-muted-foreground/50" />
                No employees found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-secondary/70">
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee ID</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Company</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedEmployees.map((employee) => (
                      <tr 
                        key={employee.id ?? employee.employeeId}
                        onClick={() => setSelectedEmployeeFromList(employee)}
                        className={`transition-colors hover:bg-secondary/60 cursor-pointer ${
                          selectedEmployeeFromList?.id === employee.id ||
                          selectedEmployeeFromList?.employeeId === employee.employeeId
                            ? "bg-secondary/80"
                            : ""
                        }`}
                      >
                        <td className="px-5 py-3.5 font-mono text-[13px] font-semibold text-navy">
                          {employee.employeeId}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] font-medium text-navy">
                          {employee.employeeName}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                          {employee.employeeCompany || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                          {employee.department || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground whitespace-nowrap">
                          {employee.createdAt
                            ? new Date(employee.createdAt).toLocaleDateString("en-US")
                            : "-"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteEmployee(employee);
                            }}
                            disabled={deletingEmployeeId === (employee.id?.toString() || employee.employeeId)}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
                            aria-label="Delete"
                          >
                            {deletingEmployeeId === (employee.id?.toString() || employee.employeeId) ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination at bottom */}
            {employees.length > 0 && totalPages > 1 && (
              <div className="border-t border-border p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-[12px] text-muted-foreground">
                  Showing <span className="font-medium text-navy">{startIndex + 1}</span> to <span className="font-medium text-navy">{Math.min(endIndex, totalEmployees)}</span> of <span className="font-medium text-navy">{totalEmployees}</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCurrentEmployeePage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentEmployeePage === 1 || employeesLoading}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[12px] font-medium text-navy transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-1">
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
                      return getPageNumbers(currentEmployeePage, totalPages).map((page, index) =>
                        typeof page === "number" ? (
                          <button
                            key={`page-${page}`}
                            onClick={() => setCurrentEmployeePage(page)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-medium transition-colors ${
                              currentEmployeePage === page
                                ? "bg-primary text-primary-foreground"
                                : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-navy"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center text-[12px] text-muted-foreground">
                            {page}
                          </span>
                        )
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setCurrentEmployeePage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentEmployeePage === totalPages || employeesLoading}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[12px] font-medium text-navy transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            {/* Selected employee info view inside right column */}
            {selectedEmployeeFromList && (
              <div className="border-t border-border p-4 bg-secondary/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-navy">Selected Employee Card</h3>
                  <button
                    onClick={() => setSelectedEmployeeFromList(null)}
                    className="p-1.5 text-muted-foreground hover:text-navy hover:bg-secondary rounded-md transition-all"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <EmployeeBarcodePrintCard
                  employee={{
                    employeeId: selectedEmployeeFromList.employeeId,
                    employeeName: selectedEmployeeFromList.employeeName,
                    employeeCompany: selectedEmployeeFromList.employeeCompany || "",
                    department: selectedEmployeeFromList.department || "",
                  }}
                  onAddAnother={() => setSelectedEmployeeFromList(null)}
                />
              </div>
            )}

          </section>
        </div>

        {employeeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]" onClick={() => setEmployeeToDelete(null)} />
            <div className="surface-card relative z-10 w-full max-w-md overflow-hidden p-6 animate-rise">
              <button onClick={() => setEmployeeToDelete(null)} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-navy">
                <X className="size-4" />
              </button>
              <div className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Delete Employee</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Are you sure you want to delete {employeeToDelete.employeeName}? Their barcode ID will be revoked.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setEmployeeToDelete(null)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent">Cancel</button>
                <button onClick={() => void confirmDeleteEmployee()} disabled={!!deletingEmployeeId} className="inline-flex items-center gap-2 rounded-lg font-semibold h-11 px-4 text-sm bg-destructive text-white hover:brightness-110 disabled:opacity-45">
                  {deletingEmployeeId ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
