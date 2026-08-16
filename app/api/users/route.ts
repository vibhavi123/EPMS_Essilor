import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { hashPassword, normalizeRole, validatePassword } from "@/lib/auth";
import { getRequestAccessContext } from "@/lib/server/accessControl";
import { generateNextAccessId } from "@/lib/server/idSequenceGenerator";

function mapUserRow(r: Record<string, unknown>) {
  return {
    id: r.Id,
    accessId: r.AccessId ?? "",
    username: r.Username,
    fullName: r.FullName,
    role: r.Role,
    department: r.Department ?? null,
    company: r.Company ?? null,
    isActive: Boolean(r.IsActive),
    createdAt: r.CreatedAt ? new Date(r.CreatedAt as string).toISOString() : null,
    updatedAt: r.UpdatedAt ? new Date(r.UpdatedAt as string).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!(accessContext.session.role === "admin" || accessContext.session.role === "superAdmin")) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    if (
      accessContext.session.role !== "superAdmin" &&
      !accessContext.permissions.accessManagementControl &&
      !accessContext.permissions.accessManagementEdit
    ) {
      return NextResponse.json(
        { success: false, message: "Access denied: management permission required" },
        { status: 403 }
      );
    }

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const pool: Pool = await getConnection();

    let rows: RowDataPacket[];
    if (search) {
      const pattern = `%${search}%`;
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, AccessId, Username, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt
         FROM Users
         WHERE Username LIKE ? OR FullName LIKE ? OR Role LIKE ?
         ORDER BY CreatedAt DESC, Id DESC`,
        [pattern, pattern, pattern]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, AccessId, Username, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt
         FROM Users ORDER BY CreatedAt DESC, Id DESC`
      );
    }

    return NextResponse.json({
      success: true,
      data: rows.map((r) => mapUserRow(r as Record<string, unknown>)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Users GET error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to load users", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!(accessContext.session.role === "admin" || accessContext.session.role === "superAdmin")) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    if (accessContext.session.role !== "superAdmin" && !accessContext.permissions.accessManagementAdd) {
      return NextResponse.json(
        { success: false, message: "Access denied: add permission required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const accessIdInput = String(body.accessId ?? "").trim();
    const username = String(body.username ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const password = String(body.password ?? "");
    const role = normalizeRole(body.role);
    const department = String(body.department ?? "").trim();
    const company = String(body.company ?? "").trim();

    if (!username || !fullName || !password) {
      return NextResponse.json(
        { success: false, message: "Username, full name, and password are required" },
        { status: 400 }
      );
    }

    const passValidation = validatePassword(password);
    if (!passValidation.valid) {
      return NextResponse.json(
        { success: false, message: passValidation.message },
        { status: 400 }
      );
    }


    const pool: Pool = await getConnection();
    const accessId = accessIdInput || (await generateNextAccessId(pool, role));

    const [dupUserRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Users WHERE REPLACE(LOWER(Username), ' ', '') = REPLACE(LOWER(?), ' ', '') LIMIT 1",
      [username]
    );
    if (dupUserRows.length > 0) {
      return NextResponse.json({ success: false, message: "Username already exists" }, { status: 409 });
    }

    const [dupNameRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Users WHERE REPLACE(LOWER(FullName), ' ', '') = REPLACE(LOWER(?), ' ', '') LIMIT 1",
      [fullName]
    );
    if (dupNameRows.length > 0) {
      return NextResponse.json({ success: false, message: "Full Name already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO Users (AccessId, Username, PasswordHash, FullName, Role, Department, Company)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accessId, username, passwordHash, fullName, role, department || null, company || null]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId, Username, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt
       FROM Users WHERE Id = ?`,
      [insertResult.insertId]
    );

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
    ).catch(() => {
      /* row may already exist */
    });

    return NextResponse.json(
      {
        success: true,
        data: mapUserRow(createdRows[0] as Record<string, unknown>),
        message: "User created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Users POST error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to create user", details: message },
      { status: 500 }
    );
  }
}
