/**
 * Frontend API Client for Holding Packages Verification
 * Location: lib/api/holdingPackagesVerification.ts
 */

export interface HoldingPackage {
  id: number;
  trackingNumber?: string;
  referenceNumber?: string;
  customerName: string;
  holdingReason?: string;
  createdAt: string;
  type: "incoming" | "outgoing";
  mode: "single" | "batch";
  verified: boolean;
  trackingNumbers?: string[];
  guardVerificationStatus: string;
}

export interface FetchHoldingPackagesResponse {
  success: boolean;
  data?: HoldingPackage[];
  count?: number;
  error?: string;
}

export interface VerifyHoldingPackagePayload {
  id: number;
  type: "incoming" | "outgoing";
  mode?: "single" | "batch";
  referenceNumber?: string;
  employeeId?: string;
  employeeVerifiedId?: string;
  guardId?: string;
}

export interface VerifyHoldingPackageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * GET: Fetch all holding packages (both incoming and outgoing)
 *
 * @example
 * const result = await fetchHoldingPackages();
 * // Returns array of packages with HoldingState = 1
 */
export async function fetchHoldingPackages(): Promise<FetchHoldingPackagesResponse> {
  try {
    const response = await fetch("/api/packages/holding", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data: FetchHoldingPackagesResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch holding packages");
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
 * PUT: Verify a holding package with verifier information
 *
 * @example;
 */
export async function verifyHoldingPackage(
  payload: VerifyHoldingPackagePayload
): Promise<VerifyHoldingPackageResponse> {
  try {
    const response = await fetch("/api/packages/holding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: VerifyHoldingPackageResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to verify holding package");
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
