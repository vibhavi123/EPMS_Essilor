import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

/** Completed / verified packages only — used by the Reports page */
const REPORT_STATUS_FILTER = `LOWER(VerificationStatus) IN ('completed', 'verified')`;

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

export interface ReportPackageRow {
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

export async function GET() {
  try {
    const pool: Pool = await getConnection();
    const isGuardVerified = (status?: string | null): boolean =>
      (status || "").trim().toLowerCase() === "verified";

    const [incomingRows] = await pool.query<RowDataPacket[]>(
      `SELECT ${INCOMING_SELECT}
       FROM IncomingPackages
       WHERE ${REPORT_STATUS_FILTER}
       ORDER BY CreatedAt DESC`
    );

    const incomingPackages = incomingRows.map((pkg) => ({
      id: String(pkg.TrackingNumber),
      type: "Incoming" as const,
      mode: (String(pkg.Mode).toLowerCase() === "batch" ? "batch" : "single") as "single" | "batch",
      referenceNumber: (pkg.ReferenceNumber as string | null) ?? null,
      customerName: pkg.CustomerName as string,
      employeeId: (pkg.EmployeeId as string | null) ?? undefined,
      employeeName: (pkg.EmployeeName as string | null) ?? undefined,
      department: (pkg.Department as string | null) ?? undefined,
      employeeCompany: (pkg.EmployeeCompany as string | null) ?? undefined,
      deliveryCompany: pkg.DeliveryCompany as string,
      deliveryPersonName: pkg.DeliveryPersonName as string,
      vehicleNumber: pkg.VehicleNumber as string,
      vehicleType: pkg.VehicleType as string,
      remark: (pkg.Remark as string | null) ?? undefined,
      status: pkg.VerificationStatus as string,
      date: pkg.Date as string,
      time: pkg.Time as string,
      trackingNumber: pkg.TrackingNumber as string,
      holdingState: Number(pkg.HoldingState),
      guardVerificationStatus: pkg.GuardVerificationStatus as string,
      guardId: (pkg.GuardId as string | null) ?? undefined,
      handOverGuardId: (pkg.HandOverGuardId as string | null) ?? undefined,
      createdAt: pkg.CreatedAt as string,
      updatedAt: pkg.UpdatedAt as string,
    }));

    const [outgoingRows] = await pool.query<RowDataPacket[]>(
      `SELECT ${OUTGOING_SELECT}
       FROM OutgoingPackages
       WHERE ${REPORT_STATUS_FILTER}
       ORDER BY CreatedAt DESC`
    );

    const outgoingPackages = outgoingRows.map((pkg) => ({
      id: String(pkg.TrackingNumber),
      type: "Outgoing" as const,
      mode: (String(pkg.Mode).toLowerCase() === "batch" ? "batch" : "single") as "single" | "batch",
      referenceNumber: (pkg.ReferenceNumber as string | null) ?? null,
      customerName: (pkg.CustomerName as string | null) ?? undefined,
      deliveryPersonName: pkg.DeliveryPersonName as string | null,
      packageDescription: pkg.PackageDescription as string,
      employeeId: (pkg.EmployeeId as string | null) ?? undefined,
      employeeName: (pkg.EmployeeName as string | null) ?? undefined,
      department: (pkg.Department as string | null) ?? undefined,
      employeeCompany: (pkg.EmployeeCompany as string | null) ?? undefined,
      deliveryCompany: pkg.DeliveryCompany as string,
      vehicleNumber: (pkg.VehicleNumber as string | null) ?? undefined,
      vehicleType: (pkg.VehicleType as string | null) ?? undefined,
      status: pkg.VerificationStatus as string,
      date: pkg.Date as string,
      time: pkg.Time as string,
      trackingNumber: pkg.TrackingNumber as string,
      holdingState: Number(pkg.HoldingState),
      guardVerificationStatus: pkg.GuardVerificationStatus as string,
      employeeVerifiedId: pkg.EmployeeVerifiedId as string | null,
      guardId: (pkg.EmployeeVerifiedId as string | null) ?? undefined,
      handOverGuardId: (pkg.HandOverGuardId as string | null) ?? undefined,
      createdAt: pkg.CreatedAt as string,
      updatedAt: pkg.UpdatedAt as string,
    }));

    const allPackages = [...incomingPackages, ...outgoingPackages].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const grouped = new Map<string, ReportPackageRow>();

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
    console.error("Fetch Report Packages API Error:", errorMessage);

    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch report packages" },
      { status: 500 }
    );
  }
}
