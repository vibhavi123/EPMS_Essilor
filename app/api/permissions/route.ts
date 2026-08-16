import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export interface UserPermissions {
  id: number;
  accessId: string;
  addOngoingPackage: boolean;
  addIncomePackage: boolean;
  addPackageEmployee: boolean;
  addPackageDescription: boolean;
  addPackageCustomer: boolean;
  addPackageDelivery: boolean;
  allPackagesView: boolean;
  allPackagesEdit: boolean;
  allPackagesDelete: boolean;
  outgoingVerification: boolean;
  incomeVerification: boolean;
  accessManagementAdd: boolean;
  accessManagementEdit: boolean;
  accessManagementControl: boolean;
  guardManagementAdd: boolean;
  guardManagementEdit: boolean;
  guardManagementDelete: boolean;
  guardManagementView: boolean;
  reportAccess: boolean;
  entryExitRecording: boolean;
  allEntryExitRecordsExport: boolean;
  verifyHoldingPackages: boolean;
  overdueEmployeeAlert: boolean;
  loginMonitor: boolean;
  employeeVerifiedIdView: boolean;
  guardVerifiedIdView: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

const permissionFieldMap: Record<string, string> = {
  addOngoingPackage: "AddOngoingPackage",
  addIncomePackage: "AddIncomePackage",
  addPackageEmployee: "AddPackageEmployee",
  addPackageDescription: "AddPackageDescription",
  addPackageCustomer: "AddPackageCustomer",
  addPackageDelivery: "AddPackageDelivery",
  allPackagesView: "AllPackagesView",
  allPackagesEdit: "AllPackagesEdit",
  allPackagesDelete: "AllPackagesDelete",
  outgoingVerification: "OutgoingVerification",
  incomeVerification: "IncomeVerification",
  accessManagementAdd: "AccessManagementAdd",
  accessManagementEdit: "AccessManagementEdit",
  accessManagementControl: "AccessManagementControl",
  guardManagementAdd: "GuardManagementAdd",
  guardManagementEdit: "GuardManagementEdit",
  guardManagementDelete: "GuardManagementDelete",
  guardManagementView: "GuardManagementView",
  reportAccess: "ReportAccess",
  entryExitRecording: "EntryExitRecording",
  allEntryExitRecordsExport: "AllEntryExitRecordsExport",
  verifyHoldingPackages: "VerifyHoldingPackages",
  overdueEmployeeAlert: "OverdueEmployeeAlert",
  loginMonitor: "LoginMonitoring",
  employeeVerifiedIdView: "EmployeeVerifiedIdView",
  guardVerifiedIdView: "GuardVerifiedIdView",
};

function mapPermissions(row: Record<string, unknown>): UserPermissions {
  return {
    id: Number(row.Id),
    accessId: String(row.AccessId),
    addOngoingPackage: Boolean(row.AddOngoingPackage),
    addIncomePackage: Boolean(row.AddIncomePackage),
    addPackageEmployee: Boolean(row.AddPackageEmployee),
    addPackageDescription: Boolean(row.AddPackageDescription),
    addPackageCustomer: Boolean(row.AddPackageCustomer),
    addPackageDelivery: Boolean(row.AddPackageDelivery),
    allPackagesView: Boolean(row.AllPackagesView),
    allPackagesEdit: Boolean(row.AllPackagesEdit),
    allPackagesDelete: Boolean(row.AllPackagesDelete),
    outgoingVerification: Boolean(row.OutgoingVerification),
    incomeVerification: Boolean(row.IncomeVerification),
    accessManagementAdd: Boolean(row.AccessManagementAdd),
    accessManagementEdit: Boolean(row.AccessManagementEdit),
    accessManagementControl: Boolean(row.AccessManagementControl),
    guardManagementAdd: Boolean(row.GuardManagementAdd),
    guardManagementEdit: Boolean(row.GuardManagementEdit),
    guardManagementDelete: Boolean(row.GuardManagementDelete),
    guardManagementView: Boolean(row.GuardManagementView),
    reportAccess: Boolean(row.ReportAccess),
    entryExitRecording: Boolean(row.EntryExitRecording),
    allEntryExitRecordsExport: Boolean(row.AllEntryExitRecordsExport),
    verifyHoldingPackages: Boolean(row.VerifyHoldingPackages),
    overdueEmployeeAlert: Boolean(row.OverdueEmployeeAlert),
    loginMonitor: Boolean(row.LoginMonitoring ?? row.LoginMonitor),
    employeeVerifiedIdView: Boolean(row.EmployeeVerifiedIdView),
    guardVerifiedIdView: Boolean(row.GuardVerifiedIdView),
    createdAt: row.CreatedAt ? new Date(row.CreatedAt as string).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt as string).toISOString() : null,
  };
}

function requireAdmin(accessContext: NonNullable<Awaited<ReturnType<typeof getRequestAccessContext>>>) {
  const role = String(accessContext.session.role || "");
  return role === "admin" || role === "superAdmin";
}

export async function GET(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!requireAdmin(accessContext)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const accessId = request.nextUrl.searchParams.get("accessId");
    if (!accessId) {
      return NextResponse.json({ success: false, message: "Valid accessId is required" }, { status: 400 });
    }

    const pool: Pool = await getConnection();

    const [userRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, AccessId FROM Users WHERE AccessId = ? LIMIT 1",
      [accessId]
    );
    if (!userRows.length) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    let [permRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM UserPermissions WHERE AccessId = ? LIMIT 1",
      [accessId]
    );

    if (!permRows.length) {
      await pool.query(
        `INSERT INTO UserPermissions (
          AccessId,
          AddOngoingPackage,
          AddIncomePackage,
          AllPackagesView,
          OutgoingVerification,
          IncomeVerification,
          EntryExitRecording,
          VerifyHoldingPackages
        ) VALUES (?, 1, 1, 1, 1, 1, 1, 1)`,
        [accessId]
      );
      [permRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM UserPermissions WHERE AccessId = ? LIMIT 1",
        [accessId]
      );
    }

    return NextResponse.json({
      success: true,
      data: mapPermissions(permRows[0] as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Permissions GET error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve permissions", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!requireAdmin(accessContext)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    if (
      !accessContext.permissions.accessManagementControl &&
      accessContext.session.role !== "superAdmin"
    ) {
      return NextResponse.json(
        { success: false, message: "Access denied: control permission required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const accessId = body.accessId as string | undefined;

    if (!accessId) {
      return NextResponse.json({ success: false, message: "Valid accessId is required" }, { status: 400 });
    }

    if (accessContext.accessId && accessContext.accessId === accessId) {
      return NextResponse.json(
        { success: false, message: "Forbidden: cannot modify your own permissions" },
        { status: 403 }
      );
    }

    const pool: Pool = await getConnection();

    const [userRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Users WHERE AccessId = ? LIMIT 1",
      [accessId]
    );
    if (!userRows.length) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const [camelKey, dbColumn] of Object.entries(permissionFieldMap)) {
      if (Object.prototype.hasOwnProperty.call(body, camelKey) && typeof body[camelKey] === "boolean") {
        updates.push(`${dbColumn} = ?`);
        params.push(body[camelKey] ? 1 : 0);
      }
    }

    if (!updates.length) {
      return NextResponse.json(
        { success: false, message: "No valid permission fields provided" },
        { status: 400 }
      );
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM UserPermissions WHERE AccessId = ? LIMIT 1",
      [accessId]
    );

    if (!existing.length) {
      const insertCols = ["AccessId", ...updates.map((u) => u.split(" = ")[0])];
      const insertPlaceholders = ["?", ...updates.map(() => "?")];
      await pool.query(
        `INSERT INTO UserPermissions (${insertCols.join(", ")}) VALUES (${insertPlaceholders.join(", ")})`,
        [accessId, ...params]
      );
    } else {
      await pool.query(
        `UPDATE UserPermissions SET ${updates.join(", ")}, UpdatedAt = NOW(6) WHERE AccessId = ?`,
        [...params, accessId]
      );
    }

    const [updatedRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM UserPermissions WHERE AccessId = ? LIMIT 1",
      [accessId]
    );

    return NextResponse.json({
      success: true,
      message: "Permissions updated successfully",
      data: mapPermissions(updatedRows[0] as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Permissions PATCH error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to update permissions", details: message },
      { status: 500 }
    );
  }
}
