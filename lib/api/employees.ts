/**
 * Employee API Utilities
 * Provides reusable functions for managing employee data across the system
 */

import { EmployeeData, EmployeeApiResponse } from "@/utils/formTypes";

/**
 * Fetch all active employees with optional filtering
 *
 * @param search - Optional search term for name or ID
 * @param company - Optional company filter
 * @param department - Optional department filter
 * @param limit - Maximum number of results (default: 50)
 * @param offset - Pagination offset (default: 0)
 * @returns Promise with list of employees
 */
export async function fetchEmployees(
  search?: string,
  company?: string,
  department?: string,
  limit: number = 50,
  offset: number = 0
): Promise<EmployeeData[]> {
  try {
    const params = new URLSearchParams();
    if (search?.trim()) {
      params.append("search", search.trim());
    }
    if (company?.trim()) {
      params.append("company", company.trim());
    }
    if (department?.trim()) {
      params.append("department", department.trim());
    }
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await fetch(`/api/employees?${params.toString()}`);
    const data: EmployeeApiResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch employees");
    }

    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch employees";
    console.error("Fetch employees error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Fetch a single employee by ID or employeeId
 *
 * @param id - Employee ID (numeric) or employeeId (string)
 * @returns Promise with employee data
 */
export async function fetchEmployeeById(id: string | number): Promise<EmployeeData> {
  try {
    const response = await fetch(`/api/employees/${id}`);
    const data: EmployeeApiResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch employee");
    }

    if (!data.data || Array.isArray(data.data)) {
      throw new Error("Invalid employee data");
    }

    return data.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch employee";
    console.error("Fetch employee by ID error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Create a new employee
 *
 * @param employeeData - Employee information (employeeId, employeeName, employeeCompany, department)
 * @returns Promise with created employee data
 */
export async function createEmployee(employeeData: {
  employeeId: string;
  employeeName: string;
  employeeCompany?: string;
  department?: string;
}): Promise<EmployeeData> {
  try {
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(employeeData),
    });

    const data: EmployeeApiResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create employee");
    }

    if (!data.data || Array.isArray(data.data)) {
      throw new Error("Invalid response data");
    }

    return data.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create employee";
    console.error("Create employee error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Update an existing employee
 *
 * @param id - Employee ID (numeric) or employeeId (string)
 * @param employeeData - Updated employee information
 * @returns Promise with success status
 */
export async function updateEmployee(
  id: string | number,
  employeeData: {
    employeeName?: string;
    employeeCompany?: string;
    department?: string;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(employeeData),
    });

    const data: EmployeeApiResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update employee");
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update employee";
    console.error("Update employee error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Search for employees by name or ID
 * This is a convenience function that handles the search logic
 *
 * @param query - Search term (name or employee ID)
 * @param limit - Maximum results (default: 20)
 * @returns Promise with filtered employees
 */
export async function searchEmployees(
  query: string,
  limit: number = 20
): Promise<EmployeeData[]> {
  return fetchEmployees(query, undefined, undefined, limit, 0);
}

/**
 * Get employees by company
 *
 * @param company - Company name
 * @param limit - Maximum results (default: 50)
 * @returns Promise with employees from specified company
 */
export async function getEmployeesByCompany(
  company: string,
  limit: number = 50
): Promise<EmployeeData[]> {
  return fetchEmployees(undefined, company, undefined, limit, 0);
}

/**
 * Get employees by department
 *
 * @param department - Department name
 * @param limit - Maximum results (default: 50)
 * @returns Promise with employees from specified department
 */
export async function getEmployeesByDepartment(
  department: string,
  limit: number = 50
): Promise<EmployeeData[]> {
  return fetchEmployees(undefined, undefined, department, limit, 0);
}

/**
 * Format employee display name
 *
 * @param employee - Employee data
 * @returns Formatted display string
 */
export function formatEmployeeDisplay(employee: EmployeeData): string {
  return `${employee.employeeName} (${employee.employeeId})`;
}

/**
 * Get employee details as a string
 *
 * @param employee - Employee data
 * @returns Formatted employee details
 */
export function getEmployeeDetails(employee: EmployeeData): string {
  const parts = [
    `ID: ${employee.employeeId}`,
    employee.employeeCompany ? `Company: ${employee.employeeCompany}` : null,
    employee.department ? `Department: ${employee.department}` : null,
  ].filter((p) => p !== null);

  return parts.join(" • ");
}
