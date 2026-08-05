import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getAuthCookieName, getRoleLandingPath, verifyAuthToken } from "@/lib/auth";
import { getConnection } from "@/lib/db";
import { FULL_PERMISSIONS, mapPermissionRecord } from "@/lib/server/accessControl";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(getAuthCookieName())?.value;

    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const session = await verifyAuthToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const userId = Number(session.sub);
    let permissions = mapPermissionRecord();
    let accessId: string | null = null;

    if (session.role === "superAdmin") {
      permissions = { ...FULL_PERMISSIONS };
    }

    if (session.role !== "superAdmin" && Number.isInteger(userId) && userId > 0) {
      const pool: Pool = await getConnection();
      const [accessRows] = await pool.query<RowDataPacket[]>(
        "SELECT AccessId, Role FROM Users WHERE Id = ? LIMIT 1",
        [userId]
      );

      accessId = (accessRows[0]?.AccessId as string | undefined) ?? null;
      const dbRole = accessRows[0]?.Role as string | undefined;

      if (accessId) {
        const [permRows] = await pool.query<RowDataPacket[]>(
          `SELECT
            AddOngoingPackage, AddIncomePackage, AllPackagesView, AllPackagesEdit, AllPackagesDelete,
            OutgoingVerification, IncomeVerification, AccessManagementAdd, AccessManagementEdit,
            AccessManagementControl, GuardManagementAdd, GuardManagementEdit, GuardManagementDelete,
            GuardManagementView, ReportAccess, EntryExitRecording, VerifyHoldingPackages,
            OverdueEmployeeAlert, LoginMonitoring, AddPackageEmployee, AddPackageDescription,
            AddPackageCustomer, AddPackageDelivery, EmployeeVerifiedIdView, GuardVerifiedIdView, AllEntryExitRecordsExport
           FROM UserPermissions WHERE AccessId = ? LIMIT 1`,
          [accessId]
        );

        if (permRows.length) {
          permissions = mapPermissionRecord(permRows[0] as Record<string, unknown>);
        } else if (dbRole === "admin" || session.role === "admin") {
          permissions = { ...FULL_PERMISSIONS };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: session.sub,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        permissions,
        accessId,
        redirectTo: getRoleLandingPath(session.role),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
