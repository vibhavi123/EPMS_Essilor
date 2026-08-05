/**
 * Delivery Companies API Utilities
 * Centralized functions for delivery company operations
 */

export interface DeliveryCompany {
  id: number;
  deliveryCompany: string;
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
 * Fetch all delivery companies with optional search
 */
export async function fetchDeliveryCompanies(
  search?: string,
  limit: number = 100,
  offset: number = 0
): Promise<DeliveryCompany[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const res = await fetch(`/api/delivery-companies?${params.toString()}`);
    const data: ApiResponse<DeliveryCompany[]> = await res.json();

    if (!data.success) throw new Error(data.message);
    return data.data || [];
  } catch (error) {
    console.error("Error fetching delivery companies:", error);
    throw error;
  }
}

/**
 * Search delivery companies by name
 */
export async function searchDeliveryCompanies(
  query: string,
  limit: number = 50
): Promise<DeliveryCompany[]> {
  return fetchDeliveryCompanies(query, limit, 0);
}

/**
 * Create a new delivery company
 */
export async function createDeliveryCompany(
  deliveryCompany: string
): Promise<DeliveryCompany> {
  try {
    const res = await fetch("/api/delivery-companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryCompany }),
    });

    const data: ApiResponse<DeliveryCompany> = await res.json();

    if (!data.success) throw new Error(data.message);
    if (!data.data) throw new Error("No data returned");

    return data.data;
  } catch (error) {
    console.error("Error creating delivery company:", error);
    throw error;
  }
}

/**
 * Format delivery company for display
 */
export function formatDeliveryCompanyDisplay(
  deliveryCompany: DeliveryCompany
): string {
  return deliveryCompany.deliveryCompany;
}
