import { getConnection } from "@/lib/db";
import { ReleasePackageBody } from "@/utils/formTypes";
import type { Pool, RowDataPacket } from "mysql2/promise";

/**
 * POST /api/packages/incoming/release
 * Release an incoming package (mark as completed by guard verification)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body: ReleasePackageBody = await request.json();

    if (!body.id) {
      return Response.json({ success: false, error: "Package ID is required" }, { status: 400 });
    }
    if (!body.status || !["completed", "holding"].includes(body.status)) {
      return Response.json(
        { success: false, error: "Status must be either 'completed' or 'holding'" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const guardVerifiedAt = body.status === "completed" ? new Date() : null;
    const holdingState = body.status === "holding" ? 1 : 0;
    const holdingReason = body.status === "holding" ? (body.holdingReason || null) : null;

    await pool.query(
      `UPDATE IncomingPackages
       SET 
         VerificationStatus = ?,
         GuardId            = ?,
         GuardVerifiedAt    = ?,
         VerifiedAt         = NOW(),
         HoldingState       = ?,
         HoldingReason      = ?,
         UpdatedAt          = NOW(6)
       WHERE Id = ?`,
      [
        body.status,
        body.guardId || null,
        guardVerifiedAt,
        holdingState,
        holdingReason,
        body.id,
      ]
    );

    const [updatedRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, VerificationStatus, GuardId, GuardVerifiedAt FROM IncomingPackages WHERE Id = ?",
      [body.id]
    );

    if (!updatedRows || updatedRows.length === 0) {
      return Response.json(
        { success: false, error: "The package could not be updated. Please verify the package exists and try again." },
        { status: 404 }
      );
    }

    const updatedPackage = updatedRows[0];

    return Response.json(
      {
        success: true,
        message: `Package ${body.status === "completed" ? "completed" : "placed on hold"}`,
        data: {
          id: updatedPackage.Id,
          status: updatedPackage.VerificationStatus,
          guardId: updatedPackage.GuardId,
          guardVerifiedAt: updatedPackage.GuardVerifiedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Release Incoming Package Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to release package" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/packages/incoming/release
 * Get packages ready for release (verified packages)
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get("trackingNumber");

    const pool: Pool = await getConnection();
    let rows: RowDataPacket[];

    if (trackingNumber) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
                VerificationStatus, GuardId, GuardVerifiedAt, HoldingState
         FROM IncomingPackages
         WHERE TrackingNumber = ? AND VerificationStatus = 'verified'
         LIMIT 1`,
        [trackingNumber]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
                VerificationStatus, GuardId, GuardVerifiedAt, \`Date\`, \`Time\`
         FROM IncomingPackages
         WHERE VerificationStatus = 'verified'
         ORDER BY CreatedAt DESC`
      );
    }

    if (!rows || rows.length === 0) {
      return Response.json({ success: true, data: [] });
    }

    const packages = rows.map((pkg: Record<string, unknown>) => ({
      id: pkg.Id,
      trackingNumber: pkg.TrackingNumber,
      referenceNumber: pkg.ReferenceNumber,
      mode: pkg.Mode,
      customerName: pkg.CustomerName,
      status: pkg.VerificationStatus,
      guardId: pkg.GuardId,
      guardVerifiedAt: pkg.GuardVerifiedAt,
      date: pkg.Date,
      time: pkg.Time,
    }));

    return Response.json({
      success: true,
      data: trackingNumber ? packages[0] : packages,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Incoming Release Packages Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch packages for release" },
      { status: 500 }
    );
  }
}
