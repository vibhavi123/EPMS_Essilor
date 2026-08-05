import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export interface UserPermissionsResponse {
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
}

const EMPTY_PERMISSIONS: UserPermissionsResponse = {
  addOngoingPackage: false,
  addIncomePackage: false,
  addPackageEmployee: false,
  addPackageDescription: false,
  addPackageCustomer: false,
  addPackageDelivery: false,
  allPackagesView: false,
  allPackagesEdit: false,
  allPackagesDelete: false,
  outgoingVerification: false,
  incomeVerification: false,
  accessManagementAdd: false,
  accessManagementEdit: false,
  accessManagementControl: false,
  guardManagementAdd: false,
  guardManagementEdit: false,
  guardManagementDelete: false,
  guardManagementView: false,
  reportAccess: false,
  entryExitRecording: false,
  allEntryExitRecordsExport: false,
  verifyHoldingPackages: false,
  overdueEmployeeAlert: false,
  loginMonitor: false,
  employeeVerifiedIdView: false,
  guardVerifiedIdView: false,
};

function mapRow(row: Record<string, unknown>): UserPermissionsResponse {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    if (!accessContext.accessId || accessContext.session.role === "superAdmin") {
      return NextResponse.json({
        success: true,
        data: {
          ...EMPTY_PERMISSIONS,
          addOngoingPackage: accessContext.permissions.addOngoingPackage,
          addIncomePackage: accessContext.permissions.addIncomePackage,
          addPackageEmployee: accessContext.permissions.addPackageEmployee,
          addPackageDescription: accessContext.permissions.addPackageDescription,
          addPackageCustomer: accessContext.permissions.addPackageCustomer,
          addPackageDelivery: accessContext.permissions.addPackageDelivery,
          allPackagesView: accessContext.permissions.allPackagesView,
          allPackagesEdit: accessContext.permissions.allPackagesEdit,
          allPackagesDelete: accessContext.permissions.allPackagesDelete,
          outgoingVerification: accessContext.permissions.outgoingVerification,
          incomeVerification: accessContext.permissions.incomeVerification,
          accessManagementAdd: accessContext.permissions.accessManagementAdd,
          accessManagementEdit: accessContext.permissions.accessManagementEdit,
          accessManagementControl: accessContext.permissions.accessManagementControl,
          guardManagementAdd: accessContext.permissions.guardManagementAdd,
          guardManagementEdit: accessContext.permissions.guardManagementEdit,
          guardManagementDelete: accessContext.permissions.guardManagementDelete,
          guardManagementView: accessContext.permissions.guardManagementView,
          reportAccess: accessContext.permissions.reportAccess,
          entryExitRecording: accessContext.permissions.entryExitRecording,
          verifyHoldingPackages: accessContext.permissions.verifyHoldingPackages,
          overdueEmployeeAlert: accessContext.permissions.overdueEmployeeAlert,
          loginMonitor:
            accessContext.session.role === "superAdmin" ||
            accessContext.permissions.accessManagementControl,
          employeeVerifiedIdView: accessContext.permissions.employeeVerifiedIdView,
          guardVerifiedIdView: accessContext.permissions.guardVerifiedIdView,
          allEntryExitRecordsExport: true,
        },
      });
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        AddOngoingPackage, AddIncomePackage, AddPackageEmployee, AddPackageDescription,
        AddPackageCustomer, AddPackageDelivery, AllPackagesView, AllPackagesEdit, AllPackagesDelete,
        OutgoingVerification, IncomeVerification, AccessManagementAdd, AccessManagementEdit,
        AccessManagementControl, GuardManagementAdd, GuardManagementEdit, GuardManagementDelete,
        GuardManagementView, ReportAccess, EntryExitRecording, AllEntryExitRecordsExport,
        VerifyHoldingPackages, OverdueEmployeeAlert, LoginMonitoring, EmployeeVerifiedIdView, GuardVerifiedIdView
       FROM UserPermissions
       WHERE AccessId = ?
       LIMIT 1`,
      [accessContext.accessId]
    );

    if (!rows.length) {
      return NextResponse.json({ success: true, data: { ...EMPTY_PERMISSIONS } });
    }

    return NextResponse.json({
      success: true,
      data: mapRow(rows[0] as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch user permissions:", message);
    return NextResponse.json(
      { success: false, message: "Failed to fetch permissions", details: message },
      { status: 500 }
    );
  }
}
