import { getConnection } from "@/lib/db";
import { HoldingPackageRecord } from "@/utils/formTypes";
import type { RowDataPacket } from "mysql2/promise";

function toPackageMode(value: unknown): "single" | "batch" {
  return String(value ?? "").toLowerCase() === "batch" ? "batch" : "single";
}

function mapHoldingPackage(
  pkg: RowDataPacket,
  type: "incoming" | "outgoing"
): HoldingPackageRecord {
  const mode = toPackageMode(pkg.Mode);
  return {
    id: Number(pkg.Id),
    trackingNumber: pkg.TrackingNumber != null ? String(pkg.TrackingNumber) : undefined,
    referenceNumber:
      mode === "batch" && pkg.ReferenceNumber != null
        ? String(pkg.ReferenceNumber)
        : undefined,
    customerName: String(
      pkg.CustomerName || (type === "outgoing" ? pkg.DeliveryCompany : null) || "N/A"
    ),
    holdingReason: pkg.HoldingReason != null ? String(pkg.HoldingReason) : undefined,
    createdAt:
      pkg.CreatedAt instanceof Date ? pkg.CreatedAt.toISOString() : String(pkg.CreatedAt ?? ""),
    type,
    mode,
    verified: pkg.GuardVerificationStatus === "verified",
    guardVerificationStatus: String(pkg.GuardVerificationStatus ?? ""),
  };
}

// GET /api/packages/holding
// Fetch all packages currently in holding state (both incoming and outgoing)
export async function GET() {
  try {
    const pool = await getConnection();

    // FETCH INCOMING PACKAGES ON HOLD
    const [incomingRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        Id, TrackingNumber, ReferenceNumber, CustomerName,
        HoldingReason, CreatedAt, \`Mode\`, GuardVerificationStatus, VerificationStatus
      FROM IncomingPackages
      WHERE VerificationStatus = 'holding'
      ORDER BY CreatedAt DESC
    `);

    const incomingPackages: HoldingPackageRecord[] = incomingRows.map((pkg) =>
      mapHoldingPackage(pkg, "incoming")
    );

    // FETCH OUTGOING PACKAGES ON HOLD
    const [outgoingRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        Id, TrackingNumber, ReferenceNumber, CustomerName, DeliveryCompany,
        HoldingReason, CreatedAt, \`Mode\`, GuardVerificationStatus, VerificationStatus
      FROM OutgoingPackages
      WHERE VerificationStatus = 'holding'
      ORDER BY CreatedAt DESC
    `);

    const outgoingPackages: HoldingPackageRecord[] = outgoingRows.map((pkg) =>
      mapHoldingPackage(pkg, "outgoing")
    );

    // DEDUPLICATE AND GROUP BATCH PACKAGES
    const allRawPackages = [...incomingPackages, ...outgoingPackages];
    const packageMap = new Map<string, HoldingPackageRecord>();

    for (const pkg of allRawPackages) {
      const key =
        pkg.mode?.toString().toLowerCase() === "batch" && pkg.referenceNumber
          ? `batch-${pkg.type}-${pkg.referenceNumber}`
          : `single-${pkg.type}-${pkg.id}`;
      if (!packageMap.has(key)) {
        packageMap.set(key, pkg);
      }
    }

    // FETCH BATCH TRACKING NUMBERS FOR GROUPED PACKAGES
    const processedPackages = await Promise.all(
      Array.from(packageMap.values()).map(async (pkg) => {
        if (pkg.mode === "batch" && pkg.referenceNumber) {
          const table =
            pkg.type === "incoming" ? "IncomingPackages" : "OutgoingPackages";
          const [batchRows] = await pool.query<RowDataPacket[]>(
            `SELECT DISTINCT TrackingNumber FROM ${table}
             WHERE ReferenceNumber = ? AND VerificationStatus = 'holding'
             ORDER BY TrackingNumber`,
            [pkg.referenceNumber]
          );
          const trackingNumbers = Array.from(
            new Set(batchRows.map((r) => String(r.TrackingNumber)))
          );
          return { ...pkg, trackingNumbers };
        }
        return pkg;
      })
    );

    // SORT BY CREATION DATE (NEWEST FIRST)
    const allPackages = processedPackages.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return Response.json({ success: true, data: allPackages, count: allPackages.length });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Holding Packages Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch holding packages" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/packages/holding
 * Verify a holding package with verifier information
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, type, mode, referenceNumber, employeeId, guardId, employeeVerifiedId } = body;
    const verifierId = (employeeVerifiedId || employeeId || guardId || "").trim();

    if (!id || !type || !verifierId) {
      return Response.json(
        { success: false, error: "Missing required fields: id, type, employeeId or guardId" },
        { status: 400 }
      );
    }
    if (type !== "incoming" && type !== "outgoing") {
      return Response.json(
        { success: false, error: "Invalid type. Must be 'incoming' or 'outgoing'" },
        { status: 400 }
      );
    }

    const pool = await getConnection();
    const table = type === "incoming" ? "IncomingPackages" : "OutgoingPackages";

    // Fetch holdingReason
    const [fetchRows] = await pool.query<RowDataPacket[]>(
      `SELECT HoldingReason FROM ${table} WHERE Id = ?`,
      [id]
    );
    const holdingReason =
      fetchRows && fetchRows.length > 0 ? fetchRows[0].HoldingReason || "" : "";

    // Determine field and status
    let guardIdField = "GuardId";
    let verificationStatus = "verified";
    let alsoSetReceiveGuard = false;

    if (type === "outgoing") {
      if (holdingReason === "Awaiting guard verification") {
        guardIdField = "HandOverGuardId";
        verificationStatus = "completed";
      } else {
        guardIdField = "EmployeeVerifiedId";
        verificationStatus = "verified";
      }
    } else if (type === "incoming") {
      if (holdingReason === "Awaiting guard verification") {
        guardIdField = "HandOverGuardId";
        verificationStatus = "completed";
        alsoSetReceiveGuard = true;
      } else {
        guardIdField = "GuardId";
        verificationStatus = "verified";
      }
    }

    const extraGuardSet = alsoSetReceiveGuard ? "GuardId = ?," : "";
    const extraGuardParams = alsoSetReceiveGuard ? [verifierId] : [];

    if (mode === "batch" && referenceNumber) {
      await pool.query(
        `UPDATE ${table}
         SET
           HoldingState            = 0,
           GuardVerificationStatus = 'verified',
           ${guardIdField}         = ?,
           ${extraGuardSet}
           GuardVerifiedAt         = NOW(6),
           VerifiedAt              = NOW(),
           VerificationStatus      = ?,
           UpdatedAt               = NOW(6)
         WHERE ReferenceNumber = ?
           AND VerificationStatus = 'holding'`,
        [verifierId, ...extraGuardParams, verificationStatus, referenceNumber]
      );
    } else {
      await pool.query(
        `UPDATE ${table}
         SET
           HoldingState            = 0,
           GuardVerificationStatus = 'verified',
           ${guardIdField}         = ?,
           ${extraGuardSet}
           GuardVerifiedAt         = NOW(6),
           VerifiedAt              = NOW(),
           VerificationStatus      = ?,
           UpdatedAt               = NOW(6)
         WHERE Id = ?`,
        [verifierId, ...extraGuardParams, verificationStatus, id]
      );
    }

    return Response.json({
      success: true,
      message: `${type === "incoming" ? "Incoming" : "Outgoing"} package verified successfully`,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Verify Holding Package Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to verify holding package" },
      { status: 500 }
    );
  }
}
