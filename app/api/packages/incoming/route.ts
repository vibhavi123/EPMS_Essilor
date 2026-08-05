import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { IncomingPackageBody } from "@/utils/formTypes";
import { generateNextReferenceNumber } from "@/lib/server/idSequenceGenerator";

// Required fields validation
const REQUIRED_FIELDS: (keyof IncomingPackageBody)[] = [
  "trackingNumber",
  "mode",
  "customerName",
  "time",
  "date",
  "deliveryCompany",
  "deliveryPersonName",
  "vehicleNumber",
  "vehicleType",
];

export async function POST(request: NextRequest) {
  try {
    const body: IncomingPackageBody = await request.json();

    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !body[field] || body[field]?.toString().trim() === ""
    );
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, message: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    if (body.mode !== "single" && body.mode !== "batch") {
      return NextResponse.json(
        { success: false, message: "Mode must be either 'single' or 'batch'" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const referenceNumber =
      body.mode === "batch"
        ? body.referenceNumber?.trim() || (await generateNextReferenceNumber(pool))
        : null;

    const verificationStatus = body.holdingState === 0 ? "verified" : "holding";
    const guardVerifiedAt = body.holdingState === 0 ? new Date() : null;

    await pool.query(
      `INSERT INTO IncomingPackages (
        TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, \`Time\`, \`Date\`,
        EmployeeId, EmployeeName, EmployeeCompany, Department,
        DeliveryCompany, DeliveryPersonName, VehicleNumber, VehicleType,
        Remark, VerificationStatus, HoldingState, GuardVerificationStatus,
        GuardId, GuardVerifiedAt, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
      [
        body.trackingNumber,
        referenceNumber,
        body.mode,
        body.customerName,
        body.time,
        body.date,
        body.employeeId || null,
        body.employeeName || null,
        body.employeeCompany || null,
        body.department || null,
        body.deliveryCompany,
        body.deliveryPersonName,
        body.vehicleNumber,
        body.vehicleType,
        body.remark || null,
        verificationStatus,
        body.holdingState,
        body.guardVerificationStatus,
        body.guardId || null,
        guardVerifiedAt,
      ]
    );

    return NextResponse.json(
      { success: true, message: "Incoming package created successfully" },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Failed to create incoming package:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (
      errorMessage.includes("Duplicate entry") ||
      errorMessage.includes("ER_DUP_ENTRY") ||
      (error as { code?: string })?.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { success: false, message: "A package with this tracking number already exists" },
        { status: 409 }
      );
    }
    if (errorMessage.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { success: false, message: "Database connection failed. Please try again later." },
        { status: 503 }
      );
    }
    if (errorMessage.includes("Unknown column")) {
      return NextResponse.json(
        { success: false, message: `Database schema error: ${errorMessage}.` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create incoming package",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const trackingNumber: string = body?.trackingNumber;
    const originalTrackingNumber: string = body?.originalTrackingNumber || trackingNumber;
    const batchTrackingNumbers: string[] = Array.isArray(body?.batchTrackingNumbers)
      ? Array.from(
          new Set(
            body.batchTrackingNumbers
              .map((v: unknown) => String(v).trim().toUpperCase())
              .filter(Boolean)
          )
        )
      : [];

    if (!trackingNumber || !originalTrackingNumber) {
      return NextResponse.json(
        { success: false, message: "trackingNumber is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [currentRows] = await pool.query<RowDataPacket[]>(
      "SELECT TrackingNumber, ReferenceNumber, `Mode` FROM IncomingPackages WHERE TrackingNumber = ? LIMIT 1",
      [originalTrackingNumber]
    );

    const currentPackage = currentRows[0] as
      | { TrackingNumber: string; ReferenceNumber: string | null; Mode: string }
      | undefined;

    if (!currentPackage) {
      return NextResponse.json({ success: false, message: "Package not found" }, { status: 404 });
    }

    if (originalTrackingNumber !== trackingNumber) {
      const [dupRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM IncomingPackages WHERE TrackingNumber = ? LIMIT 1",
        [trackingNumber]
      );
      if (dupRows.length > 0) {
        return NextResponse.json(
          { success: false, message: "A package with this tracking number already exists" },
          { status: 409 }
        );
      }
    }

    const isBatchGroup =
      String(currentPackage.Mode || "").toLowerCase() === "batch" &&
      !!currentPackage.ReferenceNumber?.trim();

    if (isBatchGroup && batchTrackingNumbers.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one tracking number is required for a batch package" },
        { status: 400 }
      );
    }

    const commonParams = [
      body.mode ?? null,
      body.customerName ?? null,
      body.time ?? null,
      body.date ?? null,
      body.employeeId ?? null,
      body.employeeName ?? null,
      body.employeeCompany ?? null,
      body.department ?? null,
      body.deliverycompany ?? body.deliveryCompany ?? null,
      body.deliveryPersonName ?? null,
      body.vehicleNumber ?? null,
      body.vehicleType ?? null,
      body.remarks ?? body.remark ?? null,
      body.verificationStatus ?? null,
      body.holdingState ?? null,
      body.holdingReason ?? null,
      body.guardVerificationStatus ?? null,
      body.guardId ?? null,
      body.handOverGuardId ?? null,
    ];

    let rowsAffected = 0;

    if (isBatchGroup) {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE IncomingPackages SET
          \`Mode\` = COALESCE(?, \`Mode\`), CustomerName = COALESCE(?, CustomerName),
          \`Time\` = COALESCE(?, \`Time\`), \`Date\` = COALESCE(?, \`Date\`),
          EmployeeId = COALESCE(?, EmployeeId), EmployeeName = COALESCE(?, EmployeeName),
          EmployeeCompany = COALESCE(?, EmployeeCompany), Department = COALESCE(?, Department),
          DeliveryCompany = COALESCE(?, DeliveryCompany),
          DeliveryPersonName = COALESCE(?, DeliveryPersonName),
          VehicleNumber = COALESCE(?, VehicleNumber), VehicleType = COALESCE(?, VehicleType),
          Remark = COALESCE(?, Remark), VerificationStatus = COALESCE(?, VerificationStatus),
          HoldingState = COALESCE(?, HoldingState), HoldingReason = COALESCE(?, HoldingReason),
          GuardVerificationStatus = COALESCE(?, GuardVerificationStatus),
          GuardId = COALESCE(?, GuardId), HandOverGuardId = COALESCE(?, HandOverGuardId),
          UpdatedAt = NOW(6)
        WHERE ReferenceNumber = ?`,
        [...commonParams, currentPackage.ReferenceNumber]
      );
      rowsAffected = result.affectedRows;
    } else {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE IncomingPackages SET
          TrackingNumber = ?,
          \`Mode\` = COALESCE(?, \`Mode\`), CustomerName = COALESCE(?, CustomerName),
          \`Time\` = COALESCE(?, \`Time\`), \`Date\` = COALESCE(?, \`Date\`),
          EmployeeId = COALESCE(?, EmployeeId), EmployeeName = COALESCE(?, EmployeeName),
          EmployeeCompany = COALESCE(?, EmployeeCompany), Department = COALESCE(?, Department),
          DeliveryCompany = COALESCE(?, DeliveryCompany),
          DeliveryPersonName = COALESCE(?, DeliveryPersonName),
          VehicleNumber = COALESCE(?, VehicleNumber), VehicleType = COALESCE(?, VehicleType),
          Remark = COALESCE(?, Remark), VerificationStatus = COALESCE(?, VerificationStatus),
          HoldingState = COALESCE(?, HoldingState), HoldingReason = COALESCE(?, HoldingReason),
          GuardVerificationStatus = COALESCE(?, GuardVerificationStatus),
          GuardId = COALESCE(?, GuardId), HandOverGuardId = COALESCE(?, HandOverGuardId),
          UpdatedAt = NOW(6)
        WHERE TrackingNumber = ?`,
        [trackingNumber, ...commonParams, originalTrackingNumber]
      );
      rowsAffected = result.affectedRows;
    }

    if (!rowsAffected) {
      return NextResponse.json({ success: false, message: "Package not found" }, { status: 404 });
    }

    if (isBatchGroup && currentPackage.ReferenceNumber) {
      const refNum = currentPackage.ReferenceNumber;

      const [existingRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM IncomingPackages WHERE ReferenceNumber = ?",
        [refNum]
      );
      const existingTrackingNumbers = existingRows
        .map((row: RowDataPacket) => String(row.TrackingNumber).trim().toUpperCase())
        .filter(Boolean);
      const existingSet = new Set(existingTrackingNumbers);
      const desiredSet = new Set(batchTrackingNumbers);

      for (const tracking of existingTrackingNumbers) {
        if (desiredSet.has(tracking)) continue;
        await pool.query(
          "DELETE FROM IncomingPackages WHERE ReferenceNumber = ? AND TrackingNumber = ?",
          [refNum, tracking]
        );
      }

      const [sourceRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM IncomingPackages WHERE ReferenceNumber = ? ORDER BY Id ASC LIMIT 1",
        [refNum]
      );
      const sourceRow = sourceRows[0] as Record<string, unknown> | undefined;

      if (sourceRow) {
        for (const tracking of batchTrackingNumbers) {
          if (existingSet.has(tracking)) continue;
          await pool.query(
            `INSERT INTO IncomingPackages (
              TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, \`Time\`, \`Date\`,
              EmployeeId, EmployeeName, EmployeeCompany, Department,
              DeliveryCompany, DeliveryPersonName, VehicleNumber, VehicleType,
              Remark, VerificationStatus, HoldingState, HoldingReason,
              GuardVerificationStatus, GuardId, HandOverGuardId,
              GuardVerifiedAt, VerifiedAt, CreatedAt, UpdatedAt
            )
            SELECT ?, ReferenceNumber, \`Mode\`, CustomerName, \`Time\`, \`Date\`,
              EmployeeId, EmployeeName, EmployeeCompany, Department,
              DeliveryCompany, DeliveryPersonName, VehicleNumber, VehicleType,
              Remark, VerificationStatus, HoldingState, HoldingReason,
              GuardVerificationStatus, GuardId, HandOverGuardId,
              GuardVerifiedAt, VerifiedAt, NOW(6), NOW(6)
            FROM IncomingPackages WHERE TrackingNumber = ?`,
            [tracking, String(sourceRow.TrackingNumber)]
          );
        }
      }
    }

    let primaryTrackingNumber = trackingNumber;
    if (isBatchGroup && currentPackage.ReferenceNumber) {
      const [primaryRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM IncomingPackages WHERE ReferenceNumber = ? ORDER BY Id ASC LIMIT 1",
        [currentPackage.ReferenceNumber]
      );
      if (primaryRows[0]?.TrackingNumber) {
        primaryTrackingNumber = String(primaryRows[0].TrackingNumber);
      }
    }

    return NextResponse.json(
      { success: true, message: "Package updated successfully", data: { trackingNumber: primaryTrackingNumber } },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Failed to update incoming package:", errorMessage);
    if (errorMessage.includes("Duplicate entry") || errorMessage.includes("ER_DUP_ENTRY")) {
      return NextResponse.json(
        { success: false, message: "A package with this tracking number already exists", details: errorMessage },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to update package", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 });
}
