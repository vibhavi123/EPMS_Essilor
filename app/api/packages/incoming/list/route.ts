import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { IncomingPackageRecord, IncomingPackage } from "@/utils/formTypes";

export const dynamic = "force-dynamic";

type IncomingPackageWithCount = IncomingPackage & { batchCount?: number };

export async function GET() {
  try {
    const pool: Pool = await getConnection();

    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        Id, TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName,
        DeliveryPersonName, VerificationStatus, \`Date\`, \`Time\`,
        HoldingState, GuardVerificationStatus
      FROM IncomingPackages
      WHERE VerificationStatus != 'holding'
      ORDER BY CreatedAt DESC
    `);

    const allPackages: IncomingPackage[] = (rows as IncomingPackageRecord[]).map((pkg) => ({
      id: Number(pkg.Id),
      trackingNumber: String(pkg.TrackingNumber),
      referenceNumber: pkg.ReferenceNumber,
      mode:
        pkg.Mode?.toString().toLowerCase() === "batch"
          ? ("batch" as const)
          : ("single" as const),
      customerName: String(pkg.CustomerName),
      deliveryPersonName: pkg.DeliveryPersonName,
      status: String(pkg.VerificationStatus),
      date: String(pkg.Date),
      time: String(pkg.Time),
      holdingState: Number(pkg.HoldingState),
      guardVerificationStatus: String(pkg.GuardVerificationStatus),
    }));

    const packageMap = new Map<string, { pkg: IncomingPackage; count: number }>();
    for (const pkg of allPackages) {
      const isBatch = pkg.mode?.toString().toLowerCase() === "batch" && pkg.referenceNumber;
      const key = isBatch ? `batch-${pkg.referenceNumber}` : `single-${pkg.id}`;
      if (!packageMap.has(key)) {
        packageMap.set(key, { pkg, count: 1 });
      } else {
        packageMap.get(key)!.count += 1;
      }
    }

    const packages: IncomingPackageWithCount[] = Array.from(packageMap.values()).map(
      ({ pkg, count }) => ({
        ...pkg,
        batchCount: pkg.mode?.toString().toLowerCase() === "batch" ? count : 1,
      })
    );

    return Response.json({ success: true, data: packages, count: packages.length });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Fetch Incoming Packages API Error:", errorMessage);
    return Response.json(
      { success: false, error: errorMessage || "Failed to fetch incoming packages" },
      { status: 500 }
    );
  }
}
