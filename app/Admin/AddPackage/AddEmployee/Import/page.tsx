"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
} from "lucide-react";

interface ParsedEmployeeRow {
  employeeName: string;
  employeeCompany: string;
  department: string;
}

interface ImportRowResult {
  row: number;
  employeeName: string;
  company: string;
  department: string;
  status: "Imported" | "Skipped" | "Failed";
  employeeId?: string;
  reason?: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
}

export default function ImportEmployeesPage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  // File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Execution state
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

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

  // CSV Parsing function
  const parseCSVText = (text: string): ParsedEmployeeRow[] => {
    const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Simple CSV line parser handling quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toUpperCase());

    // Locate column indices
    let nameIdx = headers.findIndex((h) => h.includes("NAME") || h.includes("EMPLOYEE"));
    let companyIdx = headers.findIndex((h) => h.includes("COMPANY"));
    let deptIdx = headers.findIndex((h) => h.includes("DEPARTMENT") || h.includes("DEPT"));

    // Fallbacks if exact headers not matched
    if (nameIdx === -1) nameIdx = 0;
    if (companyIdx === -1) companyIdx = 1;
    if (deptIdx === -1) deptIdx = 2;

    const rows: ParsedEmployeeRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const employeeName = cols[nameIdx] || "";
      const employeeCompany = cols[companyIdx] || "";
      const department = cols[deptIdx] || "";

      if (employeeName || employeeCompany || department) {
        rows.push({
          employeeName,
          employeeCompany,
          department,
        });
      }
    }
    return rows;
  };

  const handleFileSelect = (selectedFile: File) => {
    setParseError(null);
    setImportSummary(null);
    setImportResults([]);
    setImportError(null);

    if (!selectedFile.name.endsWith(".csv") && selectedFile.type !== "text/csv") {
      setParseError("Please select a valid CSV file (.csv)");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        const rows = parseCSVText(text);
        if (rows.length === 0) {
          setParseError("The selected CSV file contains no data rows.");
          setParsedRows([]);
        } else {
          setParsedRows(rows);
        }
      } catch (err) {
        setParseError("Failed to parse CSV file. Please ensure it is properly formatted.");
      }
    };
    reader.onerror = () => {
      setParseError("Error reading the file.");
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };



  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setImportSummary(null);
    setImportResults([]);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch("/api/employees/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employees: parsedRows,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to process employee import");
      }

      setImportSummary(data.summary);
      setImportResults(data.results || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during import.";
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

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
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => nav.routes.ADMIN.ADD_PACKAGE ? nav.router.push("/Admin/AddPackage/AddEmployee") : window.history.back()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-all border border-gray-200"
                title="Back to Employee Management"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
                Import Employees
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1.5 ml-11">
              Upload your company employee CSV file to register multiple employees. Employee IDs are automatically generated.
            </p>
          </div>

          <div className="bg-white px-5 py-2.5 rounded-lg shadow-xs border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString("en-US")}
          </div>
        </header>

        <hr className="border-gray-200 mb-8" />

        <div className="w-full space-y-8">
          {/* STEP 1: UPLOAD AREA (If not completed import) */}
          {!importSummary && (
            <section className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <h2 className="text-xl font-bold text-[#0c244c] mb-4 flex items-center gap-2">
                Upload CSV File
              </h2>

              {parseError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 font-medium text-sm">
                  {parseError}
                </div>
              )}

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#3ea5d9] bg-blue-50/50"
                      : "border-gray-300 hover:border-[#3ea5d9] bg-gray-50/50 hover:bg-blue-50/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <h3 className="text-lg font-bold text-gray-800 mb-1">
                    Select your CSV File
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Drag &amp; drop your employee CSV file here, or click to browse
                  </p>
                  <span className="inline-block px-5 py-2.5 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold text-sm rounded-lg transition-all shadow-xs">
                    Browse Files
                  </span>
                  <p className="text-xs text-gray-400 mt-4">
                    Expected columns: <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">Employee Name</code>, <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">COMPANY</code>, <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">DEPARTMENT</code>
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{file.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB · {parsedRows.length} employee rows detected
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-all"
                  >
                    Change File
                  </button>
                </div>
              )}
            </section>
          )}

          {/* STEP 2: PREVIEW TABLE (Before Execution) */}
          {parsedRows.length > 0 && !importSummary && (
            <section className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#0c244c]">
                    CSV Preview
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Review extracted employee details before starting import. Employee IDs will be generated automatically.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                    {parsedRows.length} Rows Ready
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        Importing Employees...
                      </>
                    ) : (
                      <>
                        Start Employee Import
                      </>
                    )}
                  </button>
                </div>
              </div>

              {importError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 font-medium text-sm">
                  {importError}
                </div>
              )}

              {isImporting && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#3ea5d9] border-t-transparent mb-3" />
                  <p className="font-bold text-[#0c244c] text-base">
                    Importing Employees &amp; Generating Employee IDs...
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Processing rows sequentially to guarantee sequence safety. Please do not close this page.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedRows.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {row.employeeName || <span className="text-red-400 italic">Missing</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.employeeCompany || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.department || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* STEP 3: IMPORT RESULTS SUMMARY & TABLE */}
          {importSummary && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <section className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
                <h2 className="text-2xl font-bold text-[#0c244c] mb-6 flex items-center gap-2">
                  Import Complete
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Records</p>
                    <p className="text-3xl font-black text-gray-800 mt-1">{importSummary.total}</p>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Successfully Added</p>
                    <p className="text-3xl font-black text-green-700 mt-1">{importSummary.imported}</p>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Skipped / Duplicates</p>
                    <p className="text-3xl font-black text-amber-700 mt-1">{importSummary.skipped}</p>
                  </div>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Failed</p>
                    <p className="text-3xl font-black text-red-700 mt-1">{importSummary.failed}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    Import Another CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => nav.router.push("/Admin/AddPackage/AddEmployee")}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    <FileText size={16} />
                    View All Employees
                  </button>
                </div>
              </section>

              {/* Detailed Results Table */}
              <section className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
                <h3 className="text-xl font-bold text-[#0c244c] mb-4">
                  Import Results Breakdown
                </h3>

                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Employee Name</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Generated Employee ID</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {importResults.map((res) => (
                        <tr key={res.row} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                            {res.row}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {res.employeeName}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {res.company}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {res.department}
                          </td>
                          <td className="px-4 py-3">
                            {res.status === "Imported" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                                <CheckCircle2 size={13} /> Imported
                              </span>
                            )}
                            {res.status === "Skipped" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                                <AlertTriangle size={13} /> Skipped
                              </span>
                            )}
                            {res.status === "Failed" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                                <XCircle size={13} /> Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-[#0c244c]">
                            {res.employeeId || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {res.reason || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
