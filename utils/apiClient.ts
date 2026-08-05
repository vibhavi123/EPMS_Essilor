/**
 * API Client Utility for Guard Package System
 * Provides reusable functions for communicating with the backend API
 */
export interface IncomingPackagePayload {
  trackingNumber: string;
  referenceNumber?: string;
  mode: "single" | "batch";
  customerName: string;
  time: string;
  date: string;
  deliveryCompany: string;
  deliveryPersonName?: string | undefined;
  vehicleNumber: string | undefined;
  vehicleType: string | undefined;
  remark?: string;
  employeeId?: string;
  employeeName?: string;
  employeeCompany?: string;
  department?: string;
  holdingState: 0 | 1; 
  guardVerificationStatus: "verified" | "pending";
  guardId?: string | null;
  guardVerifiedAt?: string | null;
}

export type BasePackageData = {
  trackingNumber: string;
  referenceNumber?: string | undefined;
  mode: "single" | "batch";
  customerName: string;
  time: string;
  date: string;
  deliveryCompany: string;
  deliveryPersonName?: string | undefined;
  vehicleNumber?: string | undefined;
  vehicleType?: string | undefined;
  remark?: string | undefined;
  employeeId?: string | undefined;
  employeeName?: string | undefined;
  employeeCompany?: string | undefined;
  department?: string | undefined;
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Save an incoming package to the backend
 * Handles both verified packages (with guard) and pending packages (on hold)
 *
 * @param payload
 * @returns 
 * @throws 
 */
export async function savePackage(
  payload: IncomingPackagePayload
): Promise<ApiResponse> {
  const response = await fetch("/api/packages/incoming", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: ApiResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to save package");
  }

  return data;
}

/**
 * Build a verified package payload (Guard available)
 * Used when user selects YES in GuardSelectionModal
 *
  @param baseData 
 * @param guardId 
 * @returns 
 */
export function buildVerifiedPackagePayload(
  baseData: BasePackageData,
  guardId: string
): IncomingPackagePayload {
  return {
    trackingNumber: baseData.trackingNumber,
    referenceNumber: baseData.referenceNumber,
    mode: baseData.mode,
    customerName: baseData.customerName,
    time: baseData.time,
    date: baseData.date,
    deliveryCompany: baseData.deliveryCompany,
    deliveryPersonName: baseData.deliveryPersonName,
    vehicleNumber: baseData.vehicleNumber,
    vehicleType: baseData.vehicleType,
    remark: baseData.remark,
    employeeId: baseData.employeeId,
    employeeName: baseData.employeeName,
    employeeCompany: baseData.employeeCompany,
    department: baseData.department,
    holdingState: 0,
    guardVerificationStatus: "verified",
    guardId,
    guardVerifiedAt: new Date().toISOString(),
  };
}

/**
 * Build a holding/pending package payload (No guard available)
 * Used when user selects NO in GuardSelectionModal
 *
 * @param baseData
 * @returns 
 */
export function buildHoldingPackagePayload(
  baseData: BasePackageData
): IncomingPackagePayload {
  return {
    trackingNumber: baseData.trackingNumber,
    referenceNumber: baseData.referenceNumber,
    mode: baseData.mode,
    customerName: baseData.customerName,
    time: baseData.time,
    date: baseData.date,
    deliveryCompany: baseData.deliveryCompany,
    deliveryPersonName: baseData.deliveryPersonName,
    vehicleNumber: baseData.vehicleNumber,
    vehicleType: baseData.vehicleType,
    remark: baseData.remark,
    employeeId: baseData.employeeId,
    employeeName: baseData.employeeName,
    employeeCompany: baseData.employeeCompany,
    department: baseData.department,
    holdingState: 1,
    guardVerificationStatus: "pending",
    guardId: null,
    guardVerifiedAt: null,
  };
}

//  OUTGOING PACKAGE UTILITIES 

export interface OutgoingPackagePayload {
  trackingNumber: string; 
  referenceNumber?: string;
  mode: "single" | "batch";
  customerName?: string;
  deliveryPersonName?: string;
  packageDescription: string;
  time: string;
  date: string;
  deliveryCompany?: string;
  employeeId?: string;
  employeeName?: string;
  employeeCompany?: string;
  Department?: string;
  holdingState: 0 | 1; // 0 = verified, 1 = on hold
  guardVerificationStatus: "verified" | "pending";
  employeeVerifiedId?: string | null;
  guardId?: string | null;
  guardVerifiedAt?: string | null;
}

export type BaseOutgoingPackageData = {
  trackingNumber: string; 
  referenceNumber?: string; 
  mode: "single" | "batch";
  customerName?: string;
  packageDescription: string;
  time: string;
  date: string;
  deliveryCompany?: string;
  vehicleNumber?: string | undefined;
  vehicleType?: string | undefined;
  employeeId: string | undefined;
  employeeName: string | undefined;
  employeeCompany: string | undefined;
  Department: string | undefined;};

/**
 * Save an outgoing package to the backend
 *
 * @param payload - Package data including guard verification info
 * @returns Promise with API response
 * @throws Error if the request fails
 */
export async function saveOutgoingPackage(
  payload: OutgoingPackagePayload
): Promise<ApiResponse> {
  const response = await fetch("/api/packages/outgoing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorResponse = data as Record<string, unknown>;
    const errorMessage = (errorResponse.error as string) || (errorResponse.message as string) || "Failed to save outgoing package";
    throw new Error(errorMessage);
  }

  return data;
}

/**
 * @param baseData - Core package data
 * @param guardId - Guard ID entered/scanned
 * @returns Complete payload with guard verification
 */
export function buildVerifiedOutgoingPackagePayload(
  baseData: BaseOutgoingPackageData,
  employeeVerifiedId: string
): OutgoingPackagePayload {
  return {
    trackingNumber: baseData.trackingNumber,
    referenceNumber: baseData.referenceNumber,
    mode: baseData.mode,
    customerName: baseData.customerName,
    packageDescription: baseData.packageDescription,
    time: baseData.time,
    date: baseData.date,
    deliveryCompany: baseData.deliveryCompany,
    employeeId: baseData.employeeId,
    employeeName: baseData.employeeName,
    employeeCompany: baseData.employeeCompany,
    Department: baseData.Department,
    holdingState: 0,
    guardVerificationStatus: "verified",
    employeeVerifiedId,
    guardVerifiedAt: new Date().toISOString(),
  };
}

/**
 * @param baseData - Core package data
 * @returns Complete payload without guard data
 */

export function buildHoldingOutgoingPackagePayload(
  baseData: BaseOutgoingPackageData
): OutgoingPackagePayload {
  return {
    trackingNumber: baseData.trackingNumber,
    referenceNumber: baseData.referenceNumber,
    mode: baseData.mode,
    customerName: baseData.customerName,
    packageDescription: baseData.packageDescription,
    time: baseData.time,
    date: baseData.date,
    deliveryCompany: baseData.deliveryCompany,
    employeeId: baseData.employeeId,
    employeeName: baseData.employeeName,
    employeeCompany: baseData.employeeCompany,
    Department: baseData.Department,
    holdingState: 1,
    guardVerificationStatus: "pending",
    guardId: null,
    guardVerifiedAt: null,
  };
}
