import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get("trackingNumber");

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, message: "Tracking number is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        op.Id,
        op.TrackingNumber,
        CASE WHEN op.\`Mode\` = 'single' THEN NULL ELSE op.ReferenceNumber END AS ReferenceNumber,
        op.\`Mode\`,
        op.CustomerName,
        op.Department,
        op.DeliveryPersonName,
        op.PackageDescription,
        op.\`Time\`,
        op.\`Date\`,
        op.EmployeeId,
        op.EmployeeName,
        op.EmployeeCompany,
        op.DeliveryCompany,
        op.EmployeeVerifiedId,
        op.VehicleNumber,
        op.VehicleType,
        op.Remark,
        op.VerificationStatus,
        op.HoldingState,
        op.HoldingReason,
        op.GuardVerificationStatus,
        op.HandOverGuardId,
        u.FullName AS HandOverGuardName,
        op.GuardVerifiedAt,
        op.VerifiedAt,
        op.CreatedAt,
        op.UpdatedAt
      FROM OutgoingPackages op
      LEFT JOIN Users u ON op.HandOverGuardId = u.AccessId
      WHERE op.TrackingNumber = ?`,
      [trackingNumber]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The outgoing package with this tracking number was not found in the system. Please verify the tracking number and try again.",
        },
        { status: 404 }
      );
    }

    const pkg = rows[0];

    let batchTrackingNumbers: string[] = [];
    if (pkg.Mode === "batch" && pkg.ReferenceNumber) {
      const [batchRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM OutgoingPackages WHERE ReferenceNumber = ? ORDER BY TrackingNumber",
        [pkg.ReferenceNumber]
      );
      batchTrackingNumbers = batchRows.map((r) => String(r.TrackingNumber));
    }

    let employeeVerifiedName: string | null = null;
    if (pkg.EmployeeVerifiedId) {
      const [employeeRows] = await pool.query<RowDataPacket[]>(
        "SELECT EmployeeName FROM Employees WHERE EmployeeId = ? AND IsActive = 1 LIMIT 1",
        [pkg.EmployeeVerifiedId]
      );
      if (employeeRows.length > 0) {
        employeeVerifiedName = String(employeeRows[0].EmployeeName);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: pkg.Id,
          trackingNumber: pkg.TrackingNumber,
          referenceNumber: pkg.ReferenceNumber,
          mode: pkg.Mode,
          customerName: pkg.CustomerName,
          department: pkg.Department,
          deliveryPersonName: pkg.DeliveryPersonName,
          packageDescription: pkg.PackageDescription,
          time: pkg.Time,
          date: pkg.Date,
          employeeId: pkg.EmployeeId,
          employeeName: pkg.EmployeeName,
          employeeCompany: pkg.EmployeeCompany,
          employeeVerifiedId: pkg.EmployeeVerifiedId,
          employeeVerifiedName,
          deliveryCompany: pkg.DeliveryCompany,
          vehicleNumber: pkg.VehicleNumber,
          vehicleType: pkg.VehicleType,
          remark: pkg.Remark,
          verificationStatus: pkg.VerificationStatus,
          holdingState: pkg.HoldingState,
          holdingReason: pkg.HoldingReason,
          guardVerificationStatus: pkg.GuardVerificationStatus,
          guardId: pkg.EmployeeVerifiedId ?? null,
          handOverGuardId: pkg.HandOverGuardId,
          handOverGuardName: pkg.HandOverGuardName || pkg.HandOverGuardId || null,
          guardVerifiedAt: pkg.GuardVerifiedAt,
          verifiedAt: pkg.VerifiedAt,
          createdAt: pkg.CreatedAt,
          updatedAt: pkg.UpdatedAt,
          batchTrackingNumbers,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Failed to fetch outgoing package details:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch package details",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
