import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";

interface IncomingDBRecord {
  Id: number;
  TrackingNumber: string;
  ReferenceNumber: string | null;
  Mode: string;
  CustomerName: string;
  EmployeeId: string | null;
  EmployeeName: string | null;
  Department: string | null;
  EmployeeCompany: string | null;
  DeliveryCompany: string;
  DeliveryPersonName: string;
  VehicleNumber: string;
  VehicleType: string;
  Remark: string | null;
  VerificationStatus: string;
  Date: string;
  Time: string;
  HoldingState: number;
  GuardVerificationStatus: string;
  GuardId: string | null;
  HandOverGuardId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

interface OutgoingDBRecord {
  Id: number;
  TrackingNumber: string;
  ReferenceNumber: string | null;
  Mode: string;
  CustomerName: string | null;
  DeliveryPersonName: string | null;
  PackageDescription: string;
  EmployeeId: string | null;
  EmployeeName: string | null;
  Department: string | null;
  EmployeeCompany: string | null;
  DeliveryCompany: string;
  VehicleNumber: string | null;
  VehicleType: string | null;
  VerificationStatus: string;
  Date: string;
  Time: string;
  HoldingState: number;
  GuardVerificationStatus: string;
  EmployeeVerifiedId: string | null;
  HandOverGuardId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Package {
  id: string;
  type: "Incoming" | "Outgoing";
  mode: "single" | "batch";
  referenceNumber: string | null;
  customerName?: string;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  employeeCompany?: string;
  deliveryCompany?: string;
  deliveryPersonName?: string | null;
  packageDescription?: string | null;
  remark?: string | null;
  vehicleNumber?: string;
  vehicleType?: string;
  status: string;
  date: string;
  time: string;
  trackingNumber: string;
  trackingNumbers?: string[];
  batchCount?: number;
  holdingState: number;
  guardVerificationStatus: string;
  guardId?: string;
  handOverGuardId?: string;
  employeeVerifiedId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const INCOMING_SELECT = `
  Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
  EmployeeId, EmployeeName, Department, EmployeeCompany,
  DeliveryCompany, DeliveryPersonName, VehicleNumber, VehicleType,
  Remark, VerificationStatus, \`Date\`, \`Time\`,
  HoldingState, GuardVerificationStatus, GuardId, HandOverGuardId,
  CreatedAt, UpdatedAt
`;

const OUTGOING_SELECT = `
  Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
  DeliveryPersonName, PackageDescription, EmployeeId, EmployeeName,
  Department, EmployeeCompany, DeliveryCompany, VehicleNumber, VehicleType,
  VerificationStatus, \`Date\`, \`Time\`, HoldingState, GuardVerificationStatus,
  EmployeeVerifiedId, HandOverGuardId, CreatedAt, UpdatedAt
`;

export async function GET() {
  try {
    const pool: Pool = await getConnection();
    const isGuardVerified = (status?: string | null): boolean =>
      (status || "").trim().toLowerCase() === "verified";

    const [incomingRows] = await pool.query<RowDataPacket[]>(
      `SELECT ${INCOMING_SELECT}
       FROM IncomingPackages
       WHERE VerificationStatus != 'holding'
       ORDER BY CreatedAt DESC`
    );

    const incomingPackages = (incomingRows as unknown as IncomingDBRecord[]).map((pkg) => ({
      id: pkg.TrackingNumber,
      type: "Incoming" as const,
      mode: (pkg.Mode?.toLowerCase() === "batch" ? "batch" : "single") as "single" | "batch",
      referenceNumber: pkg.ReferenceNumber,
      customerName: pkg.CustomerName,
      employeeId: pkg.EmployeeId ?? undefined,
      employeeName: pkg.EmployeeName ?? undefined,
      department: pkg.Department ?? undefined,
      employeeCompany: pkg.EmployeeCompany ?? undefined,
      deliveryCompany: pkg.DeliveryCompany,
      deliveryPersonName: pkg.DeliveryPersonName,
      vehicleNumber: pkg.VehicleNumber,
      vehicleType: pkg.VehicleType,
      remark: pkg.Remark ?? undefined,
      status: pkg.VerificationStatus,
      date: pkg.Date,
      time: pkg.Time,
      trackingNumber: pkg.TrackingNumber,
      holdingState: pkg.HoldingState,
      guardVerificationStatus: pkg.GuardVerificationStatus,
      guardId: pkg.GuardId ?? undefined,
      handOverGuardId: pkg.HandOverGuardId ?? undefined,
      createdAt: pkg.CreatedAt,
      updatedAt: pkg.UpdatedAt,
    }));

    const [outgoingRows] = await pool.query<RowDataPacket[]>(
      `SELECT ${OUTGOING_SELECT}
       FROM OutgoingPackages
       WHERE VerificationStatus != 'holding'
       ORDER BY CreatedAt DESC`
    );

    const outgoingPackages = (outgoingRows as unknown as OutgoingDBRecord[]).map((pkg) => ({
      id: pkg.TrackingNumber,
      type: "Outgoing" as const,
      mode: (pkg.Mode?.toLowerCase() === "batch" ? "batch" : "single") as "single" | "batch",
      referenceNumber: pkg.ReferenceNumber,
      customerName: pkg.CustomerName ?? undefined,
      deliveryPersonName: pkg.DeliveryPersonName,
      packageDescription: pkg.PackageDescription,
      employeeId: pkg.EmployeeId ?? undefined,
      employeeName: pkg.EmployeeName ?? undefined,
      department: pkg.Department ?? undefined,
      employeeCompany: pkg.EmployeeCompany ?? undefined,
      deliveryCompany: pkg.DeliveryCompany,
      vehicleNumber: pkg.VehicleNumber ?? undefined,
      vehicleType: pkg.VehicleType ?? undefined,
      status: pkg.VerificationStatus,
      date: pkg.Date,
      time: pkg.Time,
      trackingNumber: pkg.TrackingNumber,
      holdingState: pkg.HoldingState,
      guardVerificationStatus: pkg.GuardVerificationStatus,
      employeeVerifiedId: pkg.EmployeeVerifiedId,
      guardId: pkg.EmployeeVerifiedId ?? undefined,
      handOverGuardId: pkg.HandOverGuardId ?? undefined,
      createdAt: pkg.CreatedAt,
      updatedAt: pkg.UpdatedAt,
    }));

    const allPackages = [...incomingPackages, ...outgoingPackages].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const grouped = new Map<string, Package>();

    for (const pkg of allPackages) {
      if (pkg.mode === "batch" && pkg.referenceNumber) {
        const key = `${pkg.type}-${pkg.referenceNumber}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            ...pkg,
            trackingNumbers: [pkg.trackingNumber],
            batchCount: 1,
          });
        } else {
          const existing = grouped.get(key)!;
          existing.trackingNumbers!.push(pkg.trackingNumber);
          existing.batchCount! += 1;

          if (
            !isGuardVerified(existing.guardVerificationStatus) &&
            isGuardVerified(pkg.guardVerificationStatus)
          ) {
            existing.guardVerificationStatus = "verified";
          }
        }
      } else {
        const key = `${pkg.type}-${pkg.trackingNumber}`;
        if (!grouped.has(key)) {
          grouped.set(key, pkg);
        }
      }
    }

    const finalPackages = Array.from(grouped.values()).sort((a, b) => {
      const aVerified = isGuardVerified(a.guardVerificationStatus) ? 1 : 0;
      const bVerified = isGuardVerified(b.guardVerificationStatus) ? 1 : 0;

      if (aVerified !== bVerified) {
        return bVerified - aVerified;
      }

      return (
        new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
      );
    });

    return Response.json({
      success: true,
      data: finalPackages,
      count: finalPackages.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch All Packages API Error:", errorMessage);

    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch packages" },
      { status: 500 }
    );
  }
}
