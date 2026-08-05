/**
 * Package Descriptions API Utilities
 * Centralized functions for package description operations
 */

export interface PackageDescription {
  id: number;
  packageDescription: string;
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
 * Fetch all package descriptions with optional search
 */
export async function fetchPackageDescriptions(
  search?: string,
  limit: number = 100,
  offset: number = 0
): Promise<PackageDescription[]> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());

  const res = await fetch(`/api/package-descriptions?${params.toString()}`);
  const data: ApiResponse<PackageDescription[]> = await res.json();

  if (!data.success) throw new Error(data.message);
  return data.data || [];
}

/**
 * Search package descriptions
 */
export async function searchPackageDescriptions(
  query: string,
  limit: number = 50
): Promise<PackageDescription[]> {
  return fetchPackageDescriptions(query, limit, 0);
}

/**
 * Create a new package description
 */
export async function createPackageDescription(packageDescription: string): Promise<PackageDescription> {
  const res = await fetch("/api/package-descriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageDescription }),
  });

  const data: ApiResponse<PackageDescription> = await res.json();

  if (!data.success) throw new Error(data.message);
  if (!data.data) throw new Error("No data returned");

  return data.data;
}

/**
 * Format package description for display
 */
export function formatPackageDescriptionDisplay(desc: PackageDescription): string {
  return desc.packageDescription;
}
