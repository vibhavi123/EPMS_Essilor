import { getConnection } from "@/lib/db";
import { VerifyPackageBody } from "@/utils/formTypes";
import type { Pool, RowDataPacket } from "mysql2/promise";

const SELECT_COLS = `
  Id, TrackingNumber, ReferenceNumber, \`Mode\`, PackageDescription,
  DeliveryCompany, DeliveryPersonName, VerificationStatus,
  HoldingState, GuardVerificationStatus
`;

/** GET /api/packages/outgoing/verify — Fetch package details for verification */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get("trackingNumber");
    const referenceNumber = searchParams.get("referenceNumber");
    const id = searchParams.get("id");

    if (!trackingNumber && !referenceNumber && !id) {
      return Response.json(
        {
          success: false,
          error: "Missing required query parameter: trackingNumber, referenceNumber, or id",
        },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    let rows: RowDataPacket[];

    if (trackingNumber) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM OutgoingPackages WHERE TrackingNumber = ? LIMIT 1`,
        [trackingNumber]
      );
    } else if (referenceNumber) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM OutgoingPackages WHERE ReferenceNumber = ? ORDER BY CreatedAt DESC`,
        [referenceNumber]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${SELECT_COLS} FROM OutgoingPackages WHERE Id = ? LIMIT 1`,
        [parseInt(id!, 10)]
      );
    }

    if (!rows || rows.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "The outgoing package could not be found. Please verify the package ID and try again.",
        },
        { status: 404 }
      );
    }

    const packages = rows.map((pkg: Record<string, unknown>) => ({
      id: pkg.Id,
      trackingNumber: pkg.TrackingNumber,
      referenceNumber: pkg.ReferenceNumber,
      mode: pkg.Mode,
      packageDescription: pkg.PackageDescription,
      deliveryCompany: pkg.DeliveryCompany,
      deliveryPersonName: pkg.DeliveryPersonName,
      verificationStatus: pkg.VerificationStatus,
      holdingState: pkg.HoldingState,
      guardVerificationStatus: pkg.GuardVerificationStatus,
    }));

    if (trackingNumber || id) {
      return Response.json({ success: true, data: packages[0] });
    }

    const firstPackage = packages[0];
    if (firstPackage.mode === "single") {
      return Response.json({ success: true, data: firstPackage });
    }

    const uniqueTrackingNumbers = Array.from(
      new Set(packages.map((p) => p.trackingNumber))
    );
    return Response.json({
      success: true,
      data: { ...firstPackage, trackingNumbers: uniqueTrackingNumbers },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Outgoing Package Details Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch package" },
      { status: 500 }
    );
  }
}

/** PUT /api/packages/outgoing/verify — Verify or hold outgoing package */
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

    const [checkRows] = await pool.query<RowDataPacket[]>(
      "SELECT VerificationStatus, `Mode`, ReferenceNumber FROM OutgoingPackages WHERE Id = ?",
      [body.id]
    );

    if (!checkRows || checkRows.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "The package was not found in the system. Please verify the package ID and try again.",
        },
        { status: 404 }
      );
    }

    const currentPackage = checkRows[0] as {
      VerificationStatus: string;
      Mode?: string;
      ReferenceNumber?: string | null;
    };
    const currentStatus = String(currentPackage.VerificationStatus || "").toLowerCase();

    if (currentStatus === "completed" || currentStatus === "cancelled") {
      return Response.json(
        {
          success: false,
          error: `Cannot verify package. Package is already ${currentStatus}`,
        },
        { status: 400 }
      );
    }

    let verificationStatus: string;
    let verifiedAt: Date | null;

    if (body.holdingState === 0 && body.guardVerificationStatus === "verified") {
      verificationStatus = "completed";
      verifiedAt = new Date();
    } else {
      verificationStatus = "holding";
      verifiedAt = null;
    }

    const updateByRef =
      String(currentPackage.Mode || "").toLowerCase() === "batch" &&
      !!currentPackage.ReferenceNumber?.trim();

    const whereClause = updateByRef ? "ReferenceNumber = ?" : "Id = ?";
    const whereValue = updateByRef ? currentPackage.ReferenceNumber : body.id;

    const guardVerifiedAt = verificationStatus === "completed" ? new Date() : null;

    const [result] = await pool.query(
      `UPDATE OutgoingPackages
       SET
         HoldingState            = ?,
         HoldingReason           = ?,
         DeliveryPersonName      = ?,
         DeliveryCompany         = ?,
         GuardVerificationStatus = ?,
         HandOverGuardId         = ?,
         GuardVerifiedAt         = ?,
         VerifiedAt              = ?,
         VehicleNumber           = ?,
         VehicleType             = ?,
         VerificationStatus      = ?,
         UpdatedAt               = NOW(6)
       WHERE ${whereClause}`,
      [
        body.holdingState,
        body.holdingReason?.trim() || null,
        body.deliveryPersonName?.trim() || null,
        body.deliveryCompany?.trim() || null,
        body.guardVerificationStatus,
        handOverGuardId,
        guardVerifiedAt,
        verifiedAt,
        body.vehicleNumber?.trim() || null,
        body.vehicleType?.trim() || null,
        verificationStatus,
        whereValue,
      ]
    );

    const updatedCount = (result as { affectedRows?: number }).affectedRows ?? 0;

    const message =
      body.holdingState === 0
        ? "Outgoing package verified successfully"
        : "Outgoing package placed on hold successfully";

    return Response.json({ success: true, message, updatedCount });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Outgoing Package Verification Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to verify package" },
      { status: 500 }
    );
  }
}
