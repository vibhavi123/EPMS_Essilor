import { getConnection } from "@/lib/db";
import { generateNextReferenceNumber } from "@/lib/server/idSequenceGenerator";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const dynamic = "force-dynamic";

const SELECT_LIST_COLS = `
  Id, TrackingNumber, ReferenceNumber, \`Mode\`, PackageDescription,
  CustomerName, DeliveryCompany, DeliveryPersonName,
  VerificationStatus, HoldingState, GuardVerificationStatus, \`Time\`, \`Date\`
`;

/**
 * GET /api/packages/outgoing
 * Fetch all outgoing packages with optional filtering
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search")?.trim();

    const pool: Pool = await getConnection();

    let rows: RowDataPacket[];
    if (search) {
      const pattern = `%${search}%`;
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_LIST_COLS}
         FROM OutgoingPackages
         WHERE (ReferenceNumber LIKE ? OR TrackingNumber LIKE ?)
           AND VerificationStatus != 'holding'
         ORDER BY CreatedAt DESC`,
        [pattern, pattern]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_LIST_COLS}
         FROM OutgoingPackages
         WHERE VerificationStatus != 'holding'
         ORDER BY CreatedAt DESC`
      );
    }

    const allPackages = rows.map((pkg: Record<string, unknown>) => ({
      id: pkg.Id,
      trackingNumber: pkg.TrackingNumber,
      referenceNumber:
        pkg.Mode?.toString().toLowerCase() === "batch" ? pkg.ReferenceNumber : null,
      mode: pkg.Mode?.toString().toLowerCase() === "batch" ? "batch" : "single",
      packageDescription: pkg.PackageDescription,
      customerName: pkg.CustomerName,
      deliveryCompany: pkg.DeliveryCompany,
      deliveryPersonName: pkg.DeliveryPersonName,
      verificationStatus: pkg.VerificationStatus,
      holdingState: pkg.HoldingState,
      guardVerificationStatus: pkg.GuardVerificationStatus,
      time: pkg.Time,
      date: pkg.Date,
    }));

    const packageMap = new Map<string, { pkg: (typeof allPackages)[0]; count: number }>();

    for (const pkg of allPackages) {
      const key =
        pkg.mode?.toString().toLowerCase() === "batch" && pkg.referenceNumber
          ? `batch-${pkg.referenceNumber}`
          : `single-${pkg.id}`;

      if (!packageMap.has(key)) {
        packageMap.set(key, { pkg, count: 1 });
      } else {
        packageMap.get(key)!.count += 1;
      }
    }

    const grouped = Array.from(packageMap.values()).map(({ pkg, count }) => ({
      ...pkg,
      batchCount: pkg.mode?.toString().toLowerCase() === "batch" ? count : 1,
    }));

    const total = grouped.length;
    const clientRequestedLimit = searchParams.get("limit") !== null;

    if (clientRequestedLimit) {
      const paginated = grouped.slice(offset, offset + limit);
      return Response.json({
        success: true,
        data: paginated,
        pagination: { total, offset, limit, count: paginated.length },
      });
    }

    return Response.json({
      success: true,
      data: grouped,
      pagination: { total, offset: 0, limit: total, count: total },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Outgoing Packages Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

interface OutgoingPackageBody {
  trackingNumber: string;
  referenceNumber?: string;
  mode: "single" | "batch";
  customerName?: string;
  deliveryPersonName?: string;
  packageDescription: string;
  time: string;
  date: string;
  deliveryCompany?: string;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
  employeeId?: string;
  employeeName?: string;
  employeeCompany?: string;
  Department?: string;
  remark?: string;
  holdingState: number;
  guardVerificationStatus: "pending" | "verified";
  guardId?: string | null;
  employeeVerifiedId?: string | null;
  guardVerifiedAt?: string | null;
}

const REQUIRED_FIELDS: (keyof OutgoingPackageBody)[] = [
  "trackingNumber",
  "mode",
  "packageDescription",
  "time",
  "date",
];

/**
 * POST /api/packages/outgoing
 * Create a new outgoing package with guard verification flow
 */
export async function POST(request: Request) {
  try {
    const body: OutgoingPackageBody = await request.json();

    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !body[field] || String(body[field]).trim() === ""
    );
    if (missingFields.length > 0) {
      return Response.json(
        { success: false, error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    if (body.holdingState === 0) {
      if (body.guardVerificationStatus !== "verified") {
        return Response.json(
          {
            success: false,
            error: "Verified packages require guardVerificationStatus = 'verified'",
          },
          { status: 400 }
        );
      }
      if (!body.employeeVerifiedId?.trim() && !body.guardId?.trim()) {
        return Response.json(
          {
            success: false,
            error: "Verified packages require employeeVerifiedId or guardId",
          },
          { status: 400 }
        );
      }
      if (!body.guardVerifiedAt) {
        return Response.json(
          { success: false, error: "Verified packages require guardVerifiedAt timestamp" },
          { status: 400 }
        );
      }
    } else if (body.holdingState === 1) {
      if (body.guardVerificationStatus !== "pending") {
        return Response.json(
          {
            success: false,
            error: "On-hold packages require guardVerificationStatus = 'pending'",
          },
          { status: 400 }
        );
      }
    } else {
      return Response.json(
        { success: false, error: "holdingState must be 0 (verified) or 1 (on hold)" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const referenceNumber =
      body.mode === "batch"
        ? body.referenceNumber?.trim() || (await generateNextReferenceNumber(pool))
        : null;

    const verificationStatus = body.holdingState === 0 ? "verified" : "holding";
    const holdingReason =
      body.holdingState === 1 ? "Package placed on hold - awaiting verification" : null;
    const guardVerifiedAt =
      body.holdingState === 0
        ? body.guardVerifiedAt
          ? new Date(body.guardVerifiedAt)
          : new Date()
        : null;

    const employeeVerifiedId =
      body.employeeVerifiedId?.trim() || body.guardId?.trim() || null;

    await pool.query(
      `INSERT INTO OutgoingPackages (
        TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, DeliveryPersonName,
        PackageDescription, \`Time\`, \`Date\`, DeliveryCompany,
        VehicleNumber, VehicleType, EmployeeId, EmployeeName, EmployeeCompany,
        Department, EmployeeVerifiedId, Remark, VerificationStatus, HoldingState,
        HoldingReason, GuardVerificationStatus, GuardVerifiedAt, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
      [
        body.trackingNumber.trim(),
        referenceNumber,
        body.mode,
        body.customerName?.trim() || null,
        body.deliveryPersonName?.trim() || null,
        body.packageDescription.trim(),
        body.time.trim(),
        body.date.trim(),
        body.deliveryCompany?.trim() || "",
        body.vehicleNumber?.trim() || null,
        body.vehicleType?.trim() || null,
        body.employeeId || null,
        body.employeeName?.trim() || null,
        body.employeeCompany?.trim() || null,
        body.Department?.trim() || null,
        employeeVerifiedId,
        body.remark?.trim() || null,
        verificationStatus,
        body.holdingState,
        holdingReason,
        body.guardVerificationStatus,
        guardVerifiedAt,
      ]
    );

    return Response.json({
      success: true,
      message: "Outgoing package created successfully",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : null;

    console.error("Outgoing Package API Error:", { message: errorMessage, code: errorCode });

    if (
      errorCode === "ER_DUP_ENTRY" ||
      errorMessage.includes("Duplicate entry") ||
      errorMessage.includes("Unique")
    ) {
      return Response.json(
        {
          success: false,
          error: "Tracking number already exists. Please use a unique tracking number.",
        },
        { status: 409 }
      );
    }

    return Response.json(
      { success: false, error: errorMessage || "Failed to create outgoing package" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/packages/outgoing
 * Update outgoing package details by tracking number
 */
export async function PUT(request: Request) {
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
      return Response.json(
        { success: false, message: "trackingNumber is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [currentRows] = await pool.query<RowDataPacket[]>(
      "SELECT TrackingNumber, ReferenceNumber, `Mode` FROM OutgoingPackages WHERE TrackingNumber = ? LIMIT 1",
      [originalTrackingNumber]
    );

    const currentPackage = currentRows[0] as
      | { TrackingNumber: string; ReferenceNumber: string | null; Mode: string }
      | undefined;

    if (!currentPackage) {
      return Response.json({ success: false, message: "Package not found" }, { status: 404 });
    }

    if (originalTrackingNumber !== trackingNumber) {
      const [dupRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM OutgoingPackages WHERE TrackingNumber = ? LIMIT 1",
        [trackingNumber]
      );
      if (dupRows.length > 0) {
        return Response.json(
          { success: false, message: "A package with this tracking number already exists" },
          { status: 409 }
        );
      }
    }

    const isBatchGroup =
      String(currentPackage.Mode || "").toLowerCase() === "batch" &&
      !!currentPackage.ReferenceNumber?.trim();

    if (isBatchGroup && batchTrackingNumbers.length === 0) {
      return Response.json(
        { success: false, message: "At least one tracking number is required for a batch package" },
        { status: 400 }
      );
    }

    const commonParams = [
      body.mode ?? null,
      body.customerName ?? null,
      body.packageDescription ?? null,
      body.time ?? null,
      body.date ?? null,
      body.deliveryCompany ?? null,
      body.deliveryPersonName ?? null,
      body.vehicleNumber ?? null,
      body.vehicleType ?? null,
      body.employeeId ?? null,
      body.employeeName ?? null,
      body.employeeCompany ?? null,
      body.department ?? body.Department ?? null,
      body.remark ?? null,
      body.verificationStatus ?? null,
      body.holdingState ?? null,
      body.holdingReason ?? null,
      body.guardVerificationStatus ?? null,
      body.employeeVerifiedId ?? body.guardId ?? null,
      body.handOverGuardId ?? null,
    ];

    let rowsAffected = 0;

    if (isBatchGroup) {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE OutgoingPackages SET
          \`Mode\` = COALESCE(?, \`Mode\`), CustomerName = COALESCE(?, CustomerName),
          PackageDescription = COALESCE(?, PackageDescription),
          \`Time\` = COALESCE(?, \`Time\`), \`Date\` = COALESCE(?, \`Date\`),
          DeliveryCompany = COALESCE(?, DeliveryCompany),
          DeliveryPersonName = COALESCE(?, DeliveryPersonName),
          VehicleNumber = COALESCE(?, VehicleNumber), VehicleType = COALESCE(?, VehicleType),
          EmployeeId = COALESCE(?, EmployeeId), EmployeeName = COALESCE(?, EmployeeName),
          EmployeeCompany = COALESCE(?, EmployeeCompany), Department = COALESCE(?, Department),
          Remark = COALESCE(?, Remark), VerificationStatus = COALESCE(?, VerificationStatus),
          HoldingState = COALESCE(?, HoldingState), HoldingReason = COALESCE(?, HoldingReason),
          GuardVerificationStatus = COALESCE(?, GuardVerificationStatus),
          EmployeeVerifiedId = COALESCE(?, EmployeeVerifiedId),
          HandOverGuardId = COALESCE(?, HandOverGuardId),
          UpdatedAt = NOW(6)
        WHERE ReferenceNumber = ?`,
        [...commonParams, currentPackage.ReferenceNumber]
      );
      rowsAffected = result.affectedRows;
    } else {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE OutgoingPackages SET
          TrackingNumber = ?,
          \`Mode\` = COALESCE(?, \`Mode\`), CustomerName = COALESCE(?, CustomerName),
          PackageDescription = COALESCE(?, PackageDescription),
          \`Time\` = COALESCE(?, \`Time\`), \`Date\` = COALESCE(?, \`Date\`),
          DeliveryCompany = COALESCE(?, DeliveryCompany),
          DeliveryPersonName = COALESCE(?, DeliveryPersonName),
          VehicleNumber = COALESCE(?, VehicleNumber), VehicleType = COALESCE(?, VehicleType),
          EmployeeId = COALESCE(?, EmployeeId), EmployeeName = COALESCE(?, EmployeeName),
          EmployeeCompany = COALESCE(?, EmployeeCompany), Department = COALESCE(?, Department),
          Remark = COALESCE(?, Remark), VerificationStatus = COALESCE(?, VerificationStatus),
          HoldingState = COALESCE(?, HoldingState), HoldingReason = COALESCE(?, HoldingReason),
          GuardVerificationStatus = COALESCE(?, GuardVerificationStatus),
          EmployeeVerifiedId = COALESCE(?, EmployeeVerifiedId),
          HandOverGuardId = COALESCE(?, HandOverGuardId),
          UpdatedAt = NOW(6)
        WHERE TrackingNumber = ?`,
        [trackingNumber, ...commonParams, originalTrackingNumber]
      );
      rowsAffected = result.affectedRows;
    }

    if (!rowsAffected) {
      return Response.json({ success: false, message: "Package not found" }, { status: 404 });
    }

    if (isBatchGroup && currentPackage.ReferenceNumber) {
      const refNum = currentPackage.ReferenceNumber;

      const [existingRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM OutgoingPackages WHERE ReferenceNumber = ?",
        [refNum]
      );
      const existingTrackingNumbers = existingRows
        .map((row) => String(row.TrackingNumber).trim().toUpperCase())
        .filter(Boolean);
      const existingSet = new Set(existingTrackingNumbers);
      const desiredSet = new Set(batchTrackingNumbers);

      for (const tracking of existingTrackingNumbers) {
        if (desiredSet.has(tracking)) continue;
        await pool.query(
          "DELETE FROM OutgoingPackages WHERE ReferenceNumber = ? AND TrackingNumber = ?",
          [refNum, tracking]
        );
      }

      const [sourceRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM OutgoingPackages WHERE ReferenceNumber = ? ORDER BY Id ASC LIMIT 1",
        [refNum]
      );
      const sourceRow = sourceRows[0] as Record<string, unknown> | undefined;

      if (sourceRow) {
        for (const tracking of batchTrackingNumbers) {
          if (existingSet.has(tracking)) continue;
          await pool.query(
            `INSERT INTO OutgoingPackages (
              TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, DeliveryPersonName,
              PackageDescription, \`Time\`, \`Date\`, DeliveryCompany, VehicleNumber, VehicleType,
              EmployeeId, EmployeeName, EmployeeCompany, Department, EmployeeVerifiedId,
              Remark, VerificationStatus, HoldingState, HoldingReason,
              GuardVerificationStatus, GuardVerifiedAt, HandOverGuardId,
              CreatedAt, UpdatedAt
            )
            SELECT ?, ReferenceNumber, \`Mode\`, CustomerName, DeliveryPersonName,
              PackageDescription, \`Time\`, \`Date\`, DeliveryCompany, VehicleNumber, VehicleType,
              EmployeeId, EmployeeName, EmployeeCompany, Department, EmployeeVerifiedId,
              Remark, VerificationStatus, HoldingState, HoldingReason,
              GuardVerificationStatus, GuardVerifiedAt, HandOverGuardId,
              NOW(6), NOW(6)
            FROM OutgoingPackages WHERE TrackingNumber = ?`,
            [tracking, String(sourceRow.TrackingNumber)]
          );
        }
      }
    }

    let primaryTrackingNumber = trackingNumber;
    if (isBatchGroup && currentPackage.ReferenceNumber) {
      const [primaryRows] = await pool.query<RowDataPacket[]>(
        "SELECT TrackingNumber FROM OutgoingPackages WHERE ReferenceNumber = ? ORDER BY Id ASC LIMIT 1",
        [currentPackage.ReferenceNumber]
      );
      if (primaryRows[0]?.TrackingNumber) {
        primaryTrackingNumber = String(primaryRows[0].TrackingNumber);
      }
    }

    return Response.json({
      success: true,
      message: "Outgoing package updated successfully",
      data: { trackingNumber: primaryTrackingNumber },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Outgoing Package Update Error:", errorMessage);

    if (
      errorMessage.includes("Duplicate entry") ||
      errorMessage.includes("ER_DUP_ENTRY") ||
      errorMessage.includes("Violation of UNIQUE")
    ) {
      return Response.json(
        {
          success: false,
          message: "A package with this tracking number already exists",
          details: errorMessage,
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: false,
        message: "Failed to update package",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
