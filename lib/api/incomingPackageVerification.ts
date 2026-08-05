/**
 * Frontend API Client for Incoming Package Verification
 * Location: lib/api/incomingPackageVerification.ts
 */

export interface PackageDetailsResponse {
  success: boolean;
  data?: {
    id: number;
    trackingNumber: string;
    referenceNumber: string | null;
    mode: "single" | "batch";
    customerName: string;
    deliveryCompany: string;
    deliveryPersonName: string;
    verificationStatus: string;
    holdingState: number;
    guardVerificationStatus: string;
    handOverGuardId?: string | null;
    trackingNumbers?: string[];
  };
  error?: string;
}

export interface VerifyPackagePayload {
  id: number;
  holdingState: 0 | 1;
  guardVerificationStatus: "pending" | "verified";
  guardId?: string | null;
  handOverGuardId?: string | null;
  holdingReason?: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCompany?: string | null;
  department?: string | null;
}

export interface VerifyPackageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * GET: Fetch package details for verification
 * Query params: trackingNumber (for single) OR referenceNumber (for batch)
 */
export async function fetchPackageDetails(
  trackingNumber?: string,
  referenceNumber?: string
): Promise<PackageDetailsResponse> {
  try {
    if (!trackingNumber && !referenceNumber) {
      throw new Error("Either trackingNumber or referenceNumber is required");
    }

    const params = new URLSearchParams();
    if (trackingNumber) params.append("trackingNumber", trackingNumber);
    if (referenceNumber) params.append("referenceNumber", referenceNumber);

    const response = await fetch(
      `/api/packages/incoming/verify?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data: PackageDetailsResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch package details");
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
 * PUT: Verify or hold package
 * Called when user submits verification or places package on hold
 */
export async function verifyPackage(
  payload: VerifyPackagePayload
): Promise<VerifyPackageResponse> {
  try {
    const response = await fetch("/api/packages/incoming/verify", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: VerifyPackageResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to verify package");
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
 * HELPER: Place package on hold (guard not available)
 */
export async function holdPackage(
  packageId: number,
  holdingReason?: string,
  employeeId?: string | null,
  employeeName?: string | null,
  employeeCompany?: string | null,
  department?: string | null
): Promise<VerifyPackageResponse> {
  return verifyPackage({
    id: packageId,
    holdingState: 1,
    guardVerificationStatus: "pending",
    holdingReason,
    employeeId,
    employeeName,
    employeeCompany,
    department,
  });
}

/**
 * HELPER: Verify package with guard
 */
export async function verifyPackageWithGuard(
  packageId: number,
  handOverGuardId: string,
  employeeId?: string | null,
  employeeName?: string | null,
  employeeCompany?: string | null,
  department?: string | null
): Promise<VerifyPackageResponse> {
  return verifyPackage({
    id: packageId,
    holdingState: 0,
    guardVerificationStatus: "verified",
    handOverGuardId,
    employeeId,
    employeeName,
    employeeCompany,
    department,
  });
}
