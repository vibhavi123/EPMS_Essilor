/**
 * Frontend API Client for Outgoing Package List
 * Location: lib/api/outgoingPackageList.ts
 */

export interface OutgoingPackage {
  id: number;
  trackingNumber: string;
  referenceNumber: string | null;
  mode: "single" | "batch";
  batchCount?: number;
  packageDescription: string;
  customerName?: string;
  deliveryCompany: string;
  deliveryPersonName: string | null;
  verificationStatus: string;
  holdingState: number;
  guardVerificationStatus: string;
  time: string;
  date: string;
}

export interface FetchPackagesResponse {
  success: boolean;
  data?: OutgoingPackage[];
  pagination?: {
    total: number;
    offset: number;
    limit: number;
    count: number;
  };
  error?: string;
}

/**
 * GET: Fetch all outgoing packages with optional search
 * 
 * @example
 * // Fetch all packages
 * const result = await fetchOutgoingPackages();
 * 
 * @example
 * // Fetch with search
 * const result = await fetchOutgoingPackages({ search: "000001" });
 * 
 * @example
 * // Fetch with pagination
 * const result = await fetchOutgoingPackages({ limit: 20, offset: 0 });
 */
export async function fetchOutgoingPackages(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<FetchPackagesResponse> {
  try {
    const params = new URLSearchParams();
    
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.search) params.append("search", options.search);

    const response = await fetch(
      `/api/packages/outgoing?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data: FetchPackagesResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch packages");
    }

    return data;
  } catch (error: unknown) {
    let errorMessage = "Unknown error occurred";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
