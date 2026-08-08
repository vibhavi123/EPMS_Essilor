import { NextRequest } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getAuthCookieName, verifyAuthToken } from "@/lib/auth";

export type PermissionKey =
  | "addOngoingPackage"
  | "addIncomePackage"
  | "allPackagesView"
  | "allPackagesEdit"
  | "allPackagesDelete"
  | "outgoingVerification"
  | "incomeVerification"
  | "accessManagementAdd"
  | "accessManagementEdit"
  | "accessManagementControl"
  | "guardManagementAdd"
  | "guardManagementEdit"
  | "guardManagementDelete"
  | "guardManagementView"
  | "reportAccess"
  | "entryExitRecording"
  | "verifyHoldingPackages"
  | "overdueEmployeeAlert"
  | "addPackageEmployee"
  | "addPackageDescription"
  | "addPackageCustomer"
  | "addPackageDelivery"
  | "employeeVerifiedIdView"
  | "guardVerifiedIdView"
  | "loginMonitor";

export type PermissionsMap = Record<PermissionKey, boolean>;

export const DEFAULT_PERMISSIONS: PermissionsMap = {
  addOngoingPackage: false,
  addIncomePackage: false,
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
  verifyHoldingPackages: false,
  overdueEmployeeAlert: false,
  addPackageEmployee: false,
  addPackageDescription: false,
  addPackageCustomer: false,
  addPackageDelivery: false,
  employeeVerifiedIdView: false,
  guardVerifiedIdView: false,
  loginMonitor: false,
};

export const FULL_PERMISSIONS: PermissionsMap = {
  addOngoingPackage: true,
  addIncomePackage: true,
  allPackagesView: true,
  allPackagesEdit: true,
  allPackagesDelete: true,
  outgoingVerification: true,
  incomeVerification: true,
  accessManagementAdd: true,
  accessManagementEdit: true,
  accessManagementControl: true,
  guardManagementAdd: true,
  guardManagementEdit: true,
  guardManagementDelete: true,
  guardManagementView: true,
  reportAccess: true,
  entryExitRecording: true,
  verifyHoldingPackages: true,
  overdueEmployeeAlert: true,
  addPackageEmployee: true,
  addPackageDescription: true,
  addPackageCustomer: true,
  addPackageDelivery: true,
  employeeVerifiedIdView: true,
  guardVerifiedIdView: true,
  loginMonitor: true,
};

const PERMISSION_COLUMNS = `
  AddOngoingPackage, AddIncomePackage, AllPackagesView, AllPackagesEdit, AllPackagesDelete,
  OutgoingVerification, IncomeVerification, AccessManagementAdd, AccessManagementEdit,
  AccessManagementControl, GuardManagementAdd, GuardManagementEdit, GuardManagementDelete,
  GuardManagementView, ReportAccess, EntryExitRecording, VerifyHoldingPackages,
  OverdueEmployeeAlert, LoginMonitoring, AddPackageEmployee, AddPackageDescription,
  AddPackageCustomer, AddPackageDelivery, EmployeeVerifiedIdView, GuardVerifiedIdView, AllEntryExitRecordsExport
`;

export function mapPermissionRecord(row?: Record<string, unknown>): PermissionsMap {
  if (!row) {
    return { ...DEFAULT_PERMISSIONS };
  }

  return {
    addOngoingPackage: Boolean(row.AddOngoingPackage),
    addIncomePackage: Boolean(row.AddIncomePackage),
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
    verifyHoldingPackages: Boolean(row.VerifyHoldingPackages),
    overdueEmployeeAlert: Boolean(row.OverdueEmployeeAlert),
    addPackageEmployee: Boolean(row.AddPackageEmployee),
    addPackageDescription: Boolean(row.AddPackageDescription),
    addPackageCustomer: Boolean(row.AddPackageCustomer),
    addPackageDelivery: Boolean(row.AddPackageDelivery),
    employeeVerifiedIdView: Boolean(row.EmployeeVerifiedIdView),
    guardVerifiedIdView: Boolean(row.GuardVerifiedIdView),
    loginMonitor: Boolean(row.LoginMonitoring ?? row.LoginMonitor),
  };
}

async function fetchPermissionsByAccessId(
  pool: Pool,
  accessId: string
): Promise<PermissionsMap | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${PERMISSION_COLUMNS} FROM UserPermissions WHERE AccessId = ? LIMIT 1`,
    [accessId]
  );

  if (!rows.length) {
    return null;
  }

  return mapPermissionRecord(rows[0] as Record<string, unknown>);
}

export async function getRequestAccessContext(request: NextRequest) {
  const token = request.cookies.get(getAuthCookieName())?.value;
  if (!token) {
    return null;
  }

  const session = await verifyAuthToken(token);
  if (!session) {
    return null;
  }

  const userId = Number(session.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  if (session.role === "superAdmin") {
    return {
      session,
      userId,
      accessId: null,
      permissions: { ...FULL_PERMISSIONS },
    };
  }

  const pool = await getConnection();

  const [userRows] = await pool.query<RowDataPacket[]>(
    "SELECT AccessId, Role, IsActive FROM Users WHERE Id = ? LIMIT 1",
    [userId]
  );

  const user = userRows[0];
  if (!user || !user.IsActive) {
    return null;
  }

  const accessId = user.AccessId as string | undefined;
  if (!accessId) {
    return null;
  }

  const permissions = (await fetchPermissionsByAccessId(pool, accessId)) ?? { ...DEFAULT_PERMISSIONS };

  return {
    session,
    userId,
    accessId,
    permissions,
  };
}
