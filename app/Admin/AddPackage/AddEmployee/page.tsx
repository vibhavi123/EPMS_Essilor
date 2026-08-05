"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import EmployeeBarcodePrintCard from "@/components/EmployeeBarcodePrintCard";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { fetchNextEmployeeId } from "@/utils/idSequenceClient";
import { X } from "lucide-react";

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
      // Sort by newest first (createdAt descending)
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
      // Use the auto-generated Employee ID
      const employeeId = generatedEmployeeId || "";

      // Save employee to database via API
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

      // Reset form
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

  const renderEmployeeList = () => {
    // Calculate pagination
    const totalEmployees = employees.length;
    const totalPages = Math.ceil(totalEmployees / employeesPerPage);
    const startIndex = (currentEmployeePage - 1) * employeesPerPage;
    const endIndex = startIndex + employeesPerPage;
    const paginatedEmployees = employees.slice(startIndex, endIndex);

    return (
    <section className="mt-10 bg-white p-8 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0c244c]">All Employees</h2>
          <p className="text-sm text-gray-500 mt-1">
            Search employees by ID or name.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {employeesLoading ? "Loading employees..." : `${totalEmployees} employees - Page ${currentEmployeePage} of ${totalPages || 1}`}
        </div>
      </div>

      <form onSubmit={handleEmployeeSearch} className="mb-6 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={employeeSearchQuery}
          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
          placeholder="Search by employee ID or name"
          className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
        />
        <button
          type="submit"
          disabled={employeesLoading}
          className="px-6 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void handleEmployeeSearchClear()}
          disabled={employeesLoading || (!employeeSearchQuery && !activeEmployeeSearch)}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Clear
        </button>
      </form>

      {activeEmployeeSearch && (
        <div className="mb-4 text-sm text-gray-500">
           Results 
        </div>
      )}

      {employeesError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
          <p className="text-red-700 font-medium">{employeesError}</p>
        </div>
      )}

      {employeesLoading ? (
        <div className="py-10 text-center text-gray-500">Loading employee records...</div>
      ) : employees.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No employees have been created yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEmployees.map((employee) => (
                <tr 
                  key={employee.id ?? employee.employeeId}
                  onClick={() => setSelectedEmployeeFromList(employee)}
                  className={`cursor-pointer transition-all ${
                    selectedEmployeeFromList?.id === employee.id ||
                    selectedEmployeeFromList?.employeeId === employee.employeeId
                      ? "bg-blue-50 hover:bg-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-4 font-mono text-sm font-semibold text-[#0c244c]">
                    {employee.employeeId}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">
                    {employee.employeeName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {employee.employeeCompany || "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {employee.department || "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {employee.createdAt
                      ? new Date(employee.createdAt).toLocaleDateString("en-US")
                      : "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteEmployee(employee)}
                      disabled={deletingEmployeeId === (employee.id?.toString() || employee.employeeId)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                    >
                      {deletingEmployeeId === (employee.id?.toString() || employee.employeeId)
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {employees.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, totalEmployees)} of {totalEmployees} employees
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentEmployeePage((prev) => Math.max(prev - 1, 1))}
              disabled={currentEmployeePage === 1 || employeesLoading}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentEmployeePage(page)}
                  className={`px-3 py-2 rounded-lg font-bold transition-all ${
                    currentEmployeePage === page
                      ? "bg-[#3ea5d9] text-white"
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentEmployeePage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentEmployeePage === totalPages || employeesLoading}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-bold rounded-lg transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedEmployeeFromList && (
        <div className="mt-8 border-t pt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[#0c244c]">Selected Employee Card</h3>
            <button
              onClick={() => setSelectedEmployeeFromList(null)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              title="Close"
            >
              <X size={24} />
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
    );
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

  // Show barcode card after successful submission
  if (generatedEmployee) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
              Employee ID Card
            </h1>
            <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
              {new Date().toLocaleDateString("en-US")}
            </div>
          </header>

          <hr className="border-gray-200 mb-10" />

          <div className="max-w-5xl mx-auto">
            {success && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
                <p className="text-green-700 font-medium">{success}</p>
              </div>
            )}

            <EmployeeBarcodePrintCard
              employee={generatedEmployee}
              onAddAnother={handleAddAnother}
            />

            {renderEmployeeList()}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
            Add Employee Information
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString("en-US")}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          <section className="bg-white p-8 rounded-lg shadow-md">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Employee Name *
                </label>
                <input
                  type="text"
                  value={employeeData.employeeName}
                  onChange={(e) => handleChange(e, "employeeName")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9] focus:border-transparent"
                  placeholder="Enter employee full name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Employee Company *
                </label>
                <input
                  type="text"
                  value={employeeData.employeeCompany}
                  onChange={(e) => handleChange(e, "employeeCompany")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Department *
                </label>
                <input
                  type="text"
                  value={employeeData.department}
                  onChange={(e) => handleChange(e, "department")}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3ea5d9]"
                  placeholder="Enter department"
                />
              </div>

              {/* Employee ID Field */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Employee ID *
                </label>
                <input
                  type="text"
                  value={generatedEmployeeId || ""}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border-2 border-green-400 rounded-lg text-gray-700 font-mono font-bold text-lg"
                  placeholder="Generated on save"
                />
                {generatedEmployeeId && (
                  <p className="text-xs text-green-600 mt-2 font-semibold">
                    ✓ Employee ID auto-generated
                  </p>
                )}
              </div>
              <div className="flex gap-4 justify-start pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#3ea5d9] hover:bg-[#2d8ab8] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  {loading ? "Submitting..." : "Submit Employee Info"}
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

          {renderEmployeeList()}
        </div>

        <DeleteConfirmModal
          isOpen={employeeToDelete !== null}
          title="Remove Employee"
          message={
            employeeToDelete
              ? `Remove ${employeeToDelete.employeeName} (${employeeToDelete.employeeId}) from the employee list?`
              : "Remove this employee from the list?"
          }
          confirmText="Remove"
          onCancel={() => setEmployeeToDelete(null)}
          onConfirm={() => void confirmDeleteEmployee()}
          isSubmitting={deletingEmployeeId !== null}
        />
      </main>
    </div>
  );
}

