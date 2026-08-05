/**
 * Frontend API Client for Release Package
 * Location: lib/api/releasePackage.ts
 */

export interface ReleasePackagePayload {
  id: number;
  status: "completed" | "holding"; 
  guardId?: string | null;
  holdingReason?: string;
}

export interface ReleasePackageResponse {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    status: string;
    guardId?: string;
    guardVerifiedAt?: string;
  };
  error?: string;
}

export interface FetchReleasePackagesResponse {
  success: boolean;
  data?: Array<{
    id: number;
    trackingNumber: string;
    referenceNumber?: string;
    mode: "single" | "batch";
    status: string;
    guardId?: string;
    guardVerifiedAt?: string;
    date?: string;
    time?: string;
  }>;
  error?: string;
}

/**
 * POST: Release an incoming package
 * Call this when user clicks "Release Package" for an incoming package
 */
export async function releaseIncomingPackage(
  payload: ReleasePackagePayload
): Promise<ReleasePackageResponse> {
  try {
    const response = await fetch("/api/packages/incoming/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: ReleasePackageResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to release package");
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

/**
 * POST: Release an outgoing package
 * Call this when user clicks "Release Package" for an outgoing package
 */
export async function releaseOutgoingPackage(
  payload: ReleasePackagePayload
): Promise<ReleasePackageResponse> {
  try {
    const response = await fetch("/api/packages/outgoing/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: ReleasePackageResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to release package");
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

/**
 * GET: Fetch all incoming packages ready for release (verified status)
 */
export async function fetchIncomingReleasePackages(): Promise<FetchReleasePackagesResponse> {
  try {
    const response = await fetch("/api/packages/incoming/release", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data: FetchReleasePackagesResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch packages for release");
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

/**
 * GET: Fetch all outgoing packages ready for release (verified status)
 */
export async function fetchOutgoingReleasePackages(): Promise<FetchReleasePackagesResponse> {
  try {
    const response = await fetch("/api/packages/outgoing/release", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data: FetchReleasePackagesResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch packages for release");
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
