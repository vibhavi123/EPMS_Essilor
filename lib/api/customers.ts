/**
 * Customers API Utilities
 * Centralized functions for customer operations
 */

export interface Customer {
  id: number;
  customerName: string;
  createdAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Fetch all customers with optional search
 */
export async function fetchCustomers(
  search?: string,
  limit: number = 100,
  offset: number = 0
): Promise<Customer[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const res = await fetch(`/api/customers?${params.toString()}`);
    const data: ApiResponse<Customer[]> = await res.json();

    if (!data.success) throw new Error(data.message);
    return data.data || [];
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw error;
  }
}

/**
 * Search customers by name
 */
export async function searchCustomers(
  query: string,
  limit: number = 50
): Promise<Customer[]> {
  return fetchCustomers(query, limit, 0);
}

/**
 * Create a new customer
 */
export async function createCustomer(customerName: string): Promise<Customer> {
  try {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName }),
    });

    const data: ApiResponse<Customer> = await res.json();

    if (!data.success) throw new Error(data.message);
    if (!data.data) throw new Error("No data returned");

    return data.data;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

/**
 * Format customer for display
 */
export function formatCustomerDisplay(customer: Customer): string {
  return customer.customerName;
}
