import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";

interface VerifyPackageBody {
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

/** GET /api/packages/incoming/verify — Fetch package details for verification */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get("trackingNumber");
    const referenceNumber = searchParams.get("referenceNumber");
    const id = searchParams.get("id");

    if (!trackingNumber && !referenceNumber && !id) {
      return Response.json(
        { success: false, error: "Missing required query parameter: trackingNumber, referenceNumber, or id" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    let rows: RowDataPacket[];

    const SELECT_COLS = `
      Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
      DeliveryCompany, DeliveryPersonName, VerificationStatus,
      HoldingState, GuardVerificationStatus
    `;

    if (trackingNumber) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM IncomingPackages WHERE TrackingNumber = ? LIMIT 1`,
        [trackingNumber]
      );
    } else if (referenceNumber) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM IncomingPackages WHERE ReferenceNumber = ? ORDER BY CreatedAt DESC`,
        [referenceNumber]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM IncomingPackages WHERE Id = ? LIMIT 1`,
        [parseInt(id!)]
      );
    }

    if (!rows || rows.length === 0) {
      return Response.json(
        { success: false, error: "The incoming package could not be found. Please verify the package ID and try again." },
        { status: 404 }
      );
    }

    const packages = rows.map((pkg: Record<string, unknown>) => ({
      id: pkg.Id,
      trackingNumber: pkg.TrackingNumber,
      referenceNumber: pkg.ReferenceNumber,
      mode: pkg.Mode,
      customerName: pkg.CustomerName,
      deliveryCompany: pkg.DeliveryCompany,
      deliveryPersonName: pkg.DeliveryPersonName,
      verificationStatus: pkg.VerificationStatus,
      holdingState: pkg.HoldingState,
      guardVerificationStatus: pkg.GuardVerificationStatus,
    }));

    if (trackingNumber || id) {
      return Response.json({ success: true, data: packages[0] });
    } else {
      const firstPackage = packages[0];
      if (firstPackage.mode === "single") {
        return Response.json({ success: true, data: firstPackage });
      } else {
        const uniqueTrackingNumbers = Array.from(
          new Set(packages.map((p) => p.trackingNumber))
        );
        return Response.json({
          success: true,
          data: { ...firstPackage, trackingNumbers: uniqueTrackingNumbers },
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Package Details Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch package" },
      { status: 500 }
    );
  }
}

/** PUT /api/packages/incoming/verify — Verify or hold package */
export async function PUT(request: Request) {
  try {
    const body: VerifyPackageBody = await request.json();

    if (!body.id) {
      return Response.json({ success: false, error: "Package id is required" }, { status: 400 });
    }
    if (body.holdingState !== 0 && body.holdingState !== 1) {
      return Response.json(
        { success: false, error: "holdingState must be 0 (verified) or 1 (on hold)" },
        { status: 400 }
      );
    }
    if (body.guardVerificationStatus !== "pending" && body.guardVerificationStatus !== "verified") {
      return Response.json(
        { success: false, error: "guardVerificationStatus must be 'pending' or 'verified'" },
        { status: 400 }
      );
    }

    const handOverGuardId = body.handOverGuardId?.trim() || body.guardId?.trim() || null;

    if (body.holdingState === 0 && body.guardVerificationStatus === "verified" && !handOverGuardId) {
      return Response.json(
        { success: false, error: "Hand over guard ID is required for verification" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    // Check current status
    const [checkRows] = await pool.query<RowDataPacket[]>(
      "SELECT VerificationStatus, `Mode`, ReferenceNumber, HoldingReason FROM IncomingPackages WHERE Id = ?",
      [body.id]
    );

    if (!checkRows || checkRows.length === 0) {
      return Response.json(
        { success: false, error: "The package was not found in the system. Please verify the package ID and try again." },
        { status: 404 }
      );
    }

    const currentPackage = checkRows[0] as {
      VerificationStatus: string;
      Mode?: string;
      ReferenceNumber?: string | null;
      HoldingReason?: string | null;
    };
    const currentStatus = String(currentPackage.VerificationStatus || "").toLowerCase();
    const currentHoldingReason = String(currentPackage.HoldingReason || "").toLowerCase();

    if (currentStatus === "completed") {
      return Response.json(
        { success: false, error: `Cannot verify package. Package is already ${currentStatus}` },
        { status: 400 }
      );
    }

    // Decide new status & which guard column to set
    let newStatus: string;
    let guardField = "GuardId";

    if (body.holdingState === 0 && body.guardVerificationStatus === "verified") {
      if (!currentHoldingReason || currentHoldingReason.trim() === "") {
        guardField = "HandOverGuardId";
        newStatus = "completed";
      } else {
        guardField = "GuardId";
        newStatus = "verified";
      }
    } else {
      guardField = "GuardId";
      newStatus = "holding";
    }

    const updateByRef =
      String(currentPackage.Mode || "").toLowerCase() === "batch" &&
      !!currentPackage.ReferenceNumber?.trim();

    const guardValue = guardField === "HandOverGuardId" ? handOverGuardId : body.guardId?.trim() || null;
    const guardVerifiedAt = newStatus === "completed" ? new Date() : null;

    const whereClause = updateByRef ? "ReferenceNumber = ?" : "Id = ?";
    const whereValue = updateByRef ? currentPackage.ReferenceNumber : body.id;

    const updateSql = `
      UPDATE IncomingPackages
      SET
        VerificationStatus      = ?,
        HoldingState            = ?,
        GuardVerificationStatus = ?,
        ${guardField}           = ?,
        GuardVerifiedAt         = ?,
        EmployeeId              = ?,
        EmployeeName            = ?,
        EmployeeCompany         = ?,
        Department              = ?,
        HoldingReason           = CASE WHEN ? = 1 THEN ? ELSE NULL END,
        UpdatedAt               = NOW(6)
      WHERE ${whereClause}
    `;

    await pool.query(updateSql, [
      newStatus,
      body.holdingState,
      body.guardVerificationStatus,
      guardValue,
      guardVerifiedAt,
      body.employeeId?.trim() || null,
      body.employeeName?.trim() || null,
      body.employeeCompany?.trim() || null,
      body.department?.trim() || null,
      body.holdingState,
      body.holdingReason || null,
      whereValue,
    ]);

    // Fetch updated rows to verify
    const [updatedRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, VerificationStatus, GuardId, HandOverGuardId, GuardVerifiedAt, HoldingState
       FROM IncomingPackages WHERE ${whereClause}`,
      [whereValue]
    );

    if (!updatedRows || updatedRows.length === 0) {
      return Response.json(
        { success: false, error: "The package could not be updated. Please verify the package exists and try again." },
        { status: 404 }
      );
    }

    const message =
      body.holdingState === 0
        ? "Package verified successfully"
        : "Package placed on hold successfully";

    return Response.json({ success: true, message });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Package Verification Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to verify package" },
      { status: 500 }
    );
  }
}
