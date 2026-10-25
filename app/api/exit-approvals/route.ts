import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getRequestAccessContext } from "@/lib/server/accessControl";
import { generateNextEmployeeId } from "@/lib/server/idSequenceGenerator";

export const dynamic = "force-dynamic";

let tableEnsured = false;

export async function expireStaleExitApprovals(pool: Pool) {
  await pool.query(`
    UPDATE EmployeeExitApprovals
    SET Status = 'expired'
    WHERE Status = 'approved'
      AND ApprovedAt <= DATE_SUB(NOW(6), INTERVAL 12 HOUR)
  `);
}

export async function ensureExitApprovalsTable(pool: Pool) {
  if (!tableEnsured) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS EmployeeExitApprovals (
        Id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
        EmployeeId          VARCHAR(50)   NOT NULL,
        EmployeeName        VARCHAR(150)  NOT NULL,
        EmployeeCompany     VARCHAR(150)  NULL,
        Department          VARCHAR(100)  NULL,
        ApprovedByAccessId  VARCHAR(50)   NOT NULL,
        ApprovedByName      VARCHAR(150)  NOT NULL,
        ApprovedByRole      VARCHAR(50)   NOT NULL,
        Status              VARCHAR(30)   NOT NULL DEFAULT 'approved',
        ApprovedAt          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UsedAt              DATETIME(6)   NULL,
        GateRecordId        INT           NULL,
        INDEX IX_ExitApprovals_EmployeeId (EmployeeId),
        INDEX IX_ExitApprovals_Status (Status)
      )
    `);

    // Ensure Users table has EmployeeId column to link Admin/SuperAdmin user accounts with their Employee ID
    try {
      await pool.query(`ALTER TABLE Users ADD COLUMN EmployeeId VARCHAR(50) NULL`);
    } catch {
      // Column already exists
    }

    // Auto-link any Users whose FullName matches an active Employee in Employees
    try {
      await pool.query(`
        UPDATE Users u
        INNER JOIN Employees e
          ON REPLACE(LOWER(TRIM(u.FullName)), ' ', '') = REPLACE(LOWER(TRIM(e.EmployeeName)), ' ', '')
         AND e.IsActive = 1
        SET u.EmployeeId = e.EmployeeId
        WHERE u.EmployeeId IS NULL OR TRIM(u.EmployeeId) = ''
      `);
    } catch {
      // Ignore if update fails
    }

    tableEnsured = true;
  }

  // Automatically reset/expire any unused exit approvals older than 12 hours
  await expireStaleExitApprovals(pool);
}

export interface ApproverEmployeeProfile {
  id: number;
  employeeId: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  company: string | null;
}

/**
 * Resolves the logged-in Admin / SuperAdmin user's Employee ID (EMP...).
 * User account AccessId (ADM... / SUP...) is never used as the approver ID.
 */
async function resolveAdminApproverEmployee(
  pool: Pool,
  userId: number
): Promise<ApproverEmployeeProfile | null> {
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT Id, AccessId, EmployeeId, Username, FullName, Role, Department, Company, IsActive
     FROM Users
     WHERE Id = ? AND IsActive = 1 AND Role IN ('admin', 'superAdmin')
     LIMIT 1`,
    [userId]
  );

  if (!userRows.length) return null;
  const user = userRows[0];

  // 1. Check if user already has a valid linked EmployeeId in Employees
  if (user.EmployeeId) {
    const [empByLinkedId] = await pool.query<RowDataPacket[]>(
      `SELECT Id, EmployeeId, EmployeeName, EmployeeCompany, Department
       FROM Employees
       WHERE (EmployeeId = ? OR TRIM(EmployeeId) = ?) AND IsActive = 1
       LIMIT 1`,
      [user.EmployeeId, String(user.EmployeeId).trim()]
    );
    if (empByLinkedId.length > 0) {
      const emp = empByLinkedId[0];
      return {
        id: user.Id,
        employeeId: emp.EmployeeId,
        username: user.Username,
        fullName: emp.EmployeeName || user.FullName,
        role: user.Role,
        department: emp.Department ?? user.Department ?? null,
        company: emp.EmployeeCompany ?? user.Company ?? null,
      };
    }
  }

  // 2. Try matching by FullName or Username in Employees table
  const [empByName] = await pool.query<RowDataPacket[]>(
    `SELECT Id, EmployeeId, EmployeeName, EmployeeCompany, Department
     FROM Employees
     WHERE IsActive = 1
       AND (
         REPLACE(LOWER(TRIM(EmployeeName)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
         OR REPLACE(LOWER(TRIM(EmployeeName)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
       )
     ORDER BY Id DESC
     LIMIT 1`,
    [user.FullName || "", user.Username || ""]
  );

  if (empByName.length > 0) {
    const emp = empByName[0];
    await pool.query(`UPDATE Users SET EmployeeId = ? WHERE Id = ?`, [
      emp.EmployeeId,
      user.Id,
    ]);
    return {
      id: user.Id,
      employeeId: emp.EmployeeId,
      username: user.Username,
      fullName: emp.EmployeeName || user.FullName,
      role: user.Role,
      department: emp.Department ?? user.Department ?? null,
      company: emp.EmployeeCompany ?? user.Company ?? null,
    };
  }

  // 3. If no Employee record exists yet for this Admin/SuperAdmin, create one with an EMP... ID and link it
  const newEmployeeId = await generateNextEmployeeId(pool);
  const empName = String(user.FullName || user.Username || "Admin").trim();
  const empCompany = String(user.Company || "Company").trim();
  const empDepartment = String(user.Department || "Administration").trim();

  await pool.query(
    `INSERT INTO Employees (EmployeeId, EmployeeName, EmployeeCompany, Department, IsActive)
     VALUES (?, ?, ?, ?, 1)`,
    [newEmployeeId, empName, empCompany, empDepartment]
  );

  await pool.query(`UPDATE Users SET EmployeeId = ? WHERE Id = ?`, [
    newEmployeeId,
    user.Id,
  ]);

  return {
    id: user.Id,
    employeeId: newEmployeeId,
    username: user.Username,
    fullName: empName,
    role: user.Role,
    department: empDepartment,
    company: empCompany,
  };
}

/**
 * Checks if a given ID is a User Account AccessId (ADM..., SUP..., GRD..., etc.)
 */
async function isUserAccountAccessId(pool: Pool, rawId: string): Promise<boolean> {
  const trimmed = rawId.trim().toUpperCase();
  if (
    trimmed.startsWith("ADM") ||
    trimmed.startsWith("SUP") ||
    trimmed.startsWith("GRD") ||
    trimmed.startsWith("USR")
  ) {
    return true;
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT Id FROM Users WHERE AccessId = ? OR TRIM(AccessId) = ? LIMIT 1`,
    [rawId.trim(), rawId.trim()]
  );
  return rows.length > 0;
}

/**
 * GET /api/exit-approvals
 * Modes:
 *  1) ?meApprover=1                   -> Automatically get logged-in Admin/SuperAdmin's Employee ID & details
 *  2) ?validateAdmin=1&employeeId=... -> Validate an Employee ID that has Admin/SuperAdmin access
 *  3) ?checkEmployee=1&employeeId=... -> Check if employee has an active exit approval (for Gate Control scan)
 *  4) (default)                       -> List active/recent exit approvals
 */
export async function GET(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!accessContext.permissions.exitApproval) {
      return NextResponse.json({ success: false, message: "Exit Approval permission required" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pool: Pool = await getConnection();
    await ensureExitApprovalsTable(pool);

    // 1) Automatically resolve logged-in Admin / SuperAdmin's Employee ID
    if (searchParams.get("meApprover") === "1") {
      if (
        accessContext.session.role !== "admin" &&
        accessContext.session.role !== "superAdmin"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Only Admin or SuperAdmin accounts can approve employee exits.",
          },
          { status: 403 }
        );
      }

      const approver = await resolveAdminApproverEmployee(
        pool,
        accessContext.userId
      );

      if (!approver) {
        return NextResponse.json(
          {
            success: false,
            message: "Could not resolve an Employee ID for the logged-in Admin/SuperAdmin account.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: approver,
      });
    }

    // 2) Validate Admin / SuperAdmin by Employee ID (reject User Account AccessId)
    if (searchParams.get("validateAdmin") === "1") {
      const rawId =
        searchParams.get("employeeId")?.trim() ||
        searchParams.get("accessId")?.trim() ||
        "";
      if (!rawId) {
        return NextResponse.json(
          { success: false, message: "Admin/SuperAdmin Employee ID is required" },
          { status: 400 }
        );
      }

      if (await isUserAccountAccessId(pool, rawId)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User account ID (Access ID) cannot be used for approval in Exit Approval. Only an Employee ID (EMP...) with Admin/SuperAdmin access can be used.",
          },
          { status: 403 }
        );
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.Id, e.EmployeeId, u.Username, e.EmployeeName AS FullName, u.Role,
                COALESCE(e.Department, u.Department) AS Department,
                COALESCE(e.EmployeeCompany, u.Company) AS Company
         FROM Employees e
         INNER JOIN Users u
           ON (
             u.EmployeeId = e.EmployeeId
             OR REPLACE(LOWER(TRIM(u.FullName)), ' ', '') = REPLACE(LOWER(TRIM(e.EmployeeName)), ' ', '')
           )
         WHERE e.IsActive = 1
           AND u.IsActive = 1
           AND u.Role IN ('admin', 'superAdmin')
           AND (e.EmployeeId = ? OR TRIM(e.EmployeeId) = ?)
         LIMIT 1`,
        [rawId, rawId]
      );

      if (!rows.length) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This Employee ID does not have an active Admin or SuperAdmin access account.",
          },
          { status: 404 }
        );
      }

      const admin = rows[0];
      return NextResponse.json({
        success: true,
        message: "Admin / SuperAdmin Employee ID verified",
        data: {
          id: admin.Id,
          employeeId: admin.EmployeeId,
          username: admin.Username,
          fullName: admin.FullName,
          role: admin.Role,
          department: admin.Department ?? null,
          company: admin.Company ?? null,
        },
      });
    }

    // 3) Check if scanned employee has an active exit approval (used by Gate Control page)
    if (searchParams.get("checkEmployee") === "1") {
      const employeeId = searchParams.get("employeeId")?.trim() || "";
      if (!employeeId) {
        return NextResponse.json(
          { success: false, approved: false, message: "Employee ID is required" },
          { status: 400 }
        );
      }

      if (await isUserAccountAccessId(pool, employeeId)) {
        return NextResponse.json(
          {
            success: false,
            approved: false,
            message:
              "User account ID cannot be used at Gate Control. Please scan a valid Employee ID (EMP...).",
          },
          { status: 403 }
        );
      }

      const [approvalRows] = await pool.query<RowDataPacket[]>(
        `SELECT a.Id AS ApprovalId, a.EmployeeId, a.ApprovedByAccessId, a.ApprovedByName, a.ApprovedByRole, a.ApprovedAt,
                e.Id AS EmpDbId, e.EmployeeName, e.EmployeeCompany, e.Department, e.IsActive
         FROM EmployeeExitApprovals a
         INNER JOIN Employees e ON e.EmployeeId = a.EmployeeId AND e.IsActive = 1
         WHERE (a.EmployeeId = ? OR TRIM(a.EmployeeId) = ?)
           AND a.Status = 'approved'
           AND a.ApprovedAt > DATE_SUB(NOW(6), INTERVAL 12 HOUR)
         ORDER BY a.ApprovedAt DESC
         LIMIT 1`,
        [employeeId, employeeId]
      );

      if (!approvalRows.length) {
        return NextResponse.json(
          {
            success: false,
            approved: false,
            message:
              "Exit not approved or approval expired",
          },
          { status: 403 }
        );
      }

      const row = approvalRows[0];
      return NextResponse.json({
        success: true,
        approved: true,
        data: {
          employee: {
            id: row.EmpDbId,
            employeeId: row.EmployeeId,
            employeeName: row.EmployeeName,
            employeeCompany: row.EmployeeCompany,
            department: row.Department,
            isActive: Boolean(row.IsActive),
          },
          approval: {
            id: row.ApprovalId,
            employeeId: row.EmployeeId,
            approvedByAccessId: row.ApprovedByAccessId,
            approvedByName: row.ApprovedByName,
            approvedByRole: row.ApprovedByRole,
            approvedAt: row.ApprovedAt,
          },
        },
      });
    }

    // 4) Default: list active & recent approvals (or full report when report=1)
    const statusFilter = searchParams.get("status")?.trim();
    const isReport = searchParams.get("report") === "1";
    let sql = `
      SELECT a.Id, a.EmployeeId, a.EmployeeName, a.EmployeeCompany, a.Department,
             a.ApprovedByAccessId, a.ApprovedByName, a.ApprovedByRole,
             a.Status, a.ApprovedAt, a.UsedAt, a.GateRecordId,
             g.EmployeeExitReason, g.EntryTime AS DepartureTime, g.ExitTime AS ReturnTime, g.GuardId
      FROM EmployeeExitApprovals a
      LEFT JOIN GateRecords g ON g.Id = a.GateRecordId
    `;
    const params: string[] = [];
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "approved") {
        sql += " WHERE a.Status = 'approved' AND a.ApprovedAt > DATE_SUB(NOW(6), INTERVAL 12 HOUR)";
      } else {
        sql += " WHERE a.Status = ?";
        params.push(statusFilter);
      }
    }
    sql += isReport
      ? " ORDER BY a.ApprovedAt DESC LIMIT 5000"
      : " ORDER BY a.ApprovedAt DESC LIMIT 500";

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const data = rows.map((r) => ({
      id: r.Id,
      employeeId: r.EmployeeId,
      employeeName: r.EmployeeName,
      employeeCompany: r.EmployeeCompany ?? null,
      department: r.Department ?? null,
      approvedByAccessId: r.ApprovedByAccessId,
      approvedByName: r.ApprovedByName,
      approvedByRole: r.ApprovedByRole,
      status: r.Status,
      approvedAt: r.ApprovedAt,
      usedAt: r.UsedAt ?? null,
      gateRecordId: r.GateRecordId ?? null,
      exitReason: r.EmployeeExitReason ?? null,
      departureTime: r.DepartureTime ?? null,
      returnTime: r.ReturnTime ?? null,
      guardId: r.GuardId ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/exit-approvals error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to process exit approval query", details: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exit-approvals
 * Body: { approverEmployeeId?: string, employeeId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!accessContext.permissions.exitApproval) {
      return NextResponse.json({ success: false, message: "Exit Approval permission required" }, { status: 403 });
    }

    const body = await request.json();
    const submittedApproverId = String(
      body.approverEmployeeId ?? body.adminAccessId ?? ""
    ).trim();
    const employeeId = String(body.employeeId ?? "").trim();

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: "Requesting Employee ID is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    await ensureExitApprovalsTable(pool);

    // Explicitly block User Account AccessIds (ADM..., SUP..., GRD...) from being used anywhere in Exit Approval
    if (
      (submittedApproverId && (await isUserAccountAccessId(pool, submittedApproverId))) ||
      (await isUserAccountAccessId(pool, employeeId))
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User account ID (Access ID) cannot be used for approval in Exit Approval. Only Employee IDs (EMP...) are allowed.",
        },
        { status: 403 }
      );
    }

    // 1. Resolve Approver Employee Profile (from logged-in Admin/SuperAdmin session or verified Employee ID)
    let approver: ApproverEmployeeProfile | null = null;
    if (
      accessContext &&
      (accessContext.session.role === "admin" ||
        accessContext.session.role === "superAdmin")
    ) {
      approver = await resolveAdminApproverEmployee(
        pool,
        accessContext.userId
      );
    }

    if (!approver && submittedApproverId) {
      const [adminEmpRows] = await pool.query<RowDataPacket[]>(
        `SELECT u.Id, e.EmployeeId, u.Username, e.EmployeeName AS FullName, u.Role,
                COALESCE(e.Department, u.Department) AS Department,
                COALESCE(e.EmployeeCompany, u.Company) AS Company
         FROM Employees e
         INNER JOIN Users u
           ON (
             u.EmployeeId = e.EmployeeId
             OR REPLACE(LOWER(TRIM(u.FullName)), ' ', '') = REPLACE(LOWER(TRIM(e.EmployeeName)), ' ', '')
           )
         WHERE e.IsActive = 1
           AND u.IsActive = 1
           AND u.Role IN ('admin', 'superAdmin')
           AND (e.EmployeeId = ? OR TRIM(e.EmployeeId) = ?)
         LIMIT 1`,
        [submittedApproverId, submittedApproverId]
      );
      if (adminEmpRows.length > 0) {
        const r = adminEmpRows[0];
        approver = {
          id: r.Id,
          employeeId: r.EmployeeId,
          username: r.Username,
          fullName: r.FullName,
          role: r.Role,
          department: r.Department ?? null,
          company: r.Company ?? null,
        };
      }
    }

    if (!approver) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only an Employee ID with an active Admin or SuperAdmin access account can grant exit approval.",
        },
        { status: 403 }
      );
    }

    // 2. Verify Requesting Employee by Employee ID (EMP...)
    const [empRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, EmployeeId, EmployeeName, EmployeeCompany, Department, IsActive
       FROM Employees
       WHERE IsActive = 1
         AND (EmployeeId = ? OR TRIM(EmployeeId) = ?)
       LIMIT 1`,
      [employeeId, employeeId]
    );

    if (!empRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Requesting Employee ID not found or inactive. Please scan or type a valid Employee ID (EMP...).",
        },
        { status: 404 }
      );
    }

    const emp = empRows[0];

    // 3. Check if employee is already outside right now
    const [outsideRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id FROM GateRecords
       WHERE PersonnelId = ? AND Type = 'employee' AND ExitTime IS NULL
       LIMIT 1`,
      [emp.EmployeeId]
    );

    if (outsideRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee ${emp.EmployeeName} (${emp.EmployeeId}) is already recorded as currently outside.`,
        },
        { status: 409 }
      );
    }

    // 4. Mark any previous unused 'approved' records for this employee as superseded
    await pool.query(
      `UPDATE EmployeeExitApprovals
       SET Status = 'superseded'
       WHERE EmployeeId = ? AND Status = 'approved'`,
      [emp.EmployeeId]
    );

    // 5. Insert new approval record using the Approver's Employee ID (EMP...)
    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO EmployeeExitApprovals (
         EmployeeId, EmployeeName, EmployeeCompany, Department,
         ApprovedByAccessId, ApprovedByName, ApprovedByRole, Status, ApprovedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW(6))`,
      [
        emp.EmployeeId,
        emp.EmployeeName,
        emp.EmployeeCompany ?? null,
        emp.Department ?? null,
        approver.employeeId,
        approver.fullName,
        approver.role,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: `Exit approval granted for ${emp.EmployeeName} (${emp.EmployeeId}) by ${approver.fullName} (${approver.employeeId}). They are now enabled to exit at Gate Control.`,
        data: {
          id: insertResult.insertId,
          employeeId: emp.EmployeeId,
          employeeName: emp.EmployeeName,
          employeeCompany: emp.EmployeeCompany ?? null,
          department: emp.Department ?? null,
          approvedByAccessId: approver.employeeId,
          approvedByName: approver.fullName,
          approvedByRole: approver.role,
          status: "approved",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/exit-approvals error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to submit exit approval", details: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exit-approvals?id=...
 * Revoke a pending exit approval
 */
export async function DELETE(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!accessContext.permissions.exitApproval) {
      return NextResponse.json({ success: false, message: "Exit Approval permission required" }, { status: 403 });
    }

    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid approval ID is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    await ensureExitApprovalsTable(pool);

    const [res] = await pool.query<ResultSetHeader>(
      `UPDATE EmployeeExitApprovals SET Status = 'revoked' WHERE Id = ? AND Status = 'approved'`,
      [id]
    );

    if (res.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Approval not found or already used" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Exit approval revoked" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/exit-approvals error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to revoke exit approval", details: msg },
      { status: 500 }
    );
  }
}
