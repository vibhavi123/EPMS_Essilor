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
        ip.Id,
        ip.TrackingNumber,
        CASE WHEN ip.\`Mode\` = 'single' THEN NULL ELSE ip.ReferenceNumber END AS ReferenceNumber,
        ip.\`Mode\`,
        ip.CustomerName,
        ip.\`Time\`,
        ip.\`Date\`,
        ip.EmployeeId,
        ip.EmployeeName,
        ip.EmployeeCompany,
        ip.Department,
        ip.DeliveryCompany,
        ip.DeliveryPersonName,
        ip.VehicleNumber,
        ip.VehicleType,
        ip.Remark,
        ip.VerificationStatus,
        ip.HoldingState,
        ip.HoldingReason,
        ip.GuardVerificationStatus,
        ip.GuardId,
        ip.HandOverGuardId,
        u1.FullName AS GuardName,
        u2.FullName AS HandOverGuardName,
        ip.GuardVerifiedAt,
        ip.VerifiedAt,
        ip.CreatedAt,
        ip.UpdatedAt
      FROM IncomingPackages ip
      LEFT JOIN Users u1 ON ip.GuardId = u1.AccessId
      LEFT JOIN Users u2 ON ip.HandOverGuardId = u2.AccessId
      WHERE ip.TrackingNumber = ?`,
      [trackingNumber]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The incoming package with this tracking number was not found in the system. Please verify the tracking number and try again.",
        },
        { status: 404 }
      );
    }

    const pkg = rows[0];

    // If batch mode, fetch all related batch tracking numbers
    let batchTrackingNumbers: string[] = [];
    if (pkg.Mode === "batch" && pkg.ReferenceNumber) {
      const [batchRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM IncomingPackages WHERE ReferenceNumber = ? ORDER BY TrackingNumber",
        [pkg.ReferenceNumber]
      );
      batchTrackingNumbers = batchRows.map((r: RowDataPacket) => String(r.TrackingNumber));
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
          time: pkg.Time,
          date: pkg.Date,
          employeeId: pkg.EmployeeId,
          employeeName: pkg.EmployeeName,
          employeeCompany: pkg.EmployeeCompany,
          department: pkg.Department,
          deliveryCompany: pkg.DeliveryCompany,
          deliveryPersonName: pkg.DeliveryPersonName,
          vehicleNumber: pkg.VehicleNumber,
          vehicleType: pkg.VehicleType,
          remark: pkg.Remark,
          verificationStatus: pkg.VerificationStatus,
          holdingState: pkg.HoldingState,
          holdingReason: pkg.HoldingReason,
          guardVerificationStatus: pkg.GuardVerificationStatus,
          guardId: pkg.GuardId,
          guardName: pkg.GuardName || pkg.GuardId || null,
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
    console.error("API Error - Failed to fetch incoming package details:", {
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
