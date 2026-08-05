/**
 * Frontend API Client for Outgoing Package Verification
 * Location: lib/api/outgoingPackageVerification.ts
 */

/**
 * Single Package Response
 */
export interface PackageDetailsResponse {
  success: boolean;
  data?: {
    id: number;
    trackingNumber: string;
    referenceNumber: string | null;
    mode: "single" | "batch";
    packageDescription: string;
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

/**
 * Payload for verifying/holding package
 */
export interface VerifyPackagePayload {
  id: number;
  holdingState: 0 | 1;
  guardVerificationStatus: "pending" | "verified";
  guardId?: string | null;
  handOverGuardId?: string | null;
  holdingReason?: string;
  deliveryPersonName?: string | null;
  deliveryCompany?: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
}

/**
 * Response after verification attempt
 */
export interface VerifyPackageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 
 * @example * 
 * @example
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
      `/api/packages/outgoing/verify?${params.toString()}`,
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
 * 
 * @example
 * // Place on hold (no guard available)
 * await verifyPackage({
 *   id: 1,
 *   holdingState: 1,
 *   guardVerificationStatus: "pending"
 * });
 * 
 * @example
 * // Verify with guard
 * await verifyPackage({
 *   id: 1,
 *   holdingState: 0,
 *   guardVerificationStatus: "verified",
 *   guardId: "G-001"
 * });
 */
export async function verifyPackage(
  payload: VerifyPackagePayload
): Promise<VerifyPackageResponse> {
  try {
    const response = await fetch("/api/packages/outgoing/verify", {
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
 * 
 * @example
 * await holdPackage(1, "Guard temporarily unavailable");
 */
export async function holdPackage(
  packageId: number,
  holdingReason?: string,
  deliveryPersonName?: string | null,
  deliveryCompany?: string | null,
  vehicleNumber?: string | null,
  vehicleType?: string | null
): Promise<VerifyPackageResponse> {
  return verifyPackage({
    id: packageId,
    holdingState: 1,
    guardVerificationStatus: "pending",
    holdingReason,
    deliveryPersonName,
    deliveryCompany,
    vehicleNumber,
    vehicleType,
  });
}

/**
 * HELPER: Verify package with guard
 * 
 * @example
 * await verifyPackageWithGuard(1, "G-001");
 */
export async function verifyPackageWithGuard(
  packageId: number,
  handOverGuardId: string,
  deliveryPersonName?: string | null,
  deliveryCompany?: string | null,
  vehicleNumber?: string | null,
  vehicleType?: string | null
): Promise<VerifyPackageResponse> {
  return verifyPackage({
    id: packageId,
    holdingState: 0,
    guardVerificationStatus: "verified",
    handOverGuardId,
    deliveryPersonName,
    deliveryCompany,
    vehicleNumber,
    vehicleType,
  });
}
