import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getRequestAccessContext } from "@/lib/server/accessControl";
import { generateNextAccessId } from "@/lib/server/idSequenceGenerator";

function mapGuard(r: Record<string, unknown>) {
  return {
    id: r.Id,
    accessId: r.AccessId,
    guardName: r.guardName ?? r.FullName,
    guardCompany: r.guardCompany ?? r.Company ?? null,
    department: r.Department ?? null,
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

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const pool: Pool = await getConnection();

    let rows: RowDataPacket[];
    if (search) {
      const pattern = `%${search}%`;
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, AccessId, FullName AS guardName, Company AS guardCompany,
                Department, IsActive, CreatedAt, UpdatedAt
         FROM Users
         WHERE Role = 'guard' AND IsActive = 1 AND (AccessId LIKE ? OR FullName LIKE ?)
         ORDER BY CreatedAt DESC, Id DESC`,
        [pattern, pattern]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, AccessId, FullName AS guardName, Company AS guardCompany,
                Department, IsActive, CreatedAt, UpdatedAt
         FROM Users WHERE Role = 'guard' AND IsActive = 1 ORDER BY CreatedAt DESC, Id DESC`
      );
    }

    return NextResponse.json({
      success: true,
      data: rows.map((r) => mapGuard(r as Record<string, unknown>)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Guards GET error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to load guards", details: message },
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

    const body = await request.json();
    const accessIdInput = String(body.accessId ?? "").trim();
    const guardName = String(body.guardName ?? "").trim();
    const guardCompany = String(body.guardCompany ?? "").trim();
    const department = String(body.department ?? "").trim();

    if (!guardName || !guardCompany) {
      return NextResponse.json(
        { success: false, message: "Guard name and company are required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const accessId = accessIdInput || (await generateNextAccessId(pool, "guard"));

    const [dupRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Users WHERE AccessId = ? LIMIT 1",
      [accessId]
    );
    if (dupRows.length > 0) {
      return NextResponse.json({ success: false, message: "Access ID already exists" }, { status: 409 });
    }

    const tempUsername = `guard_${accessId.toLowerCase()}`;
    const tempPassword = "Guard@123";
    const passwordHash = await hashPassword(tempPassword);

    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO Users (AccessId, Username, PasswordHash, FullName, Role, Department, Company, IsActive)
       VALUES (?, ?, ?, ?, 'guard', ?, ?, 1)`,
      [accessId, tempUsername, passwordHash, guardName, department || null, guardCompany]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId, FullName AS guardName, Company AS guardCompany,
              Department, IsActive, CreatedAt, UpdatedAt
       FROM Users WHERE Id = ?`,
      [insertResult.insertId]
    );

    return NextResponse.json(
      {
        success: true,
        data: mapGuard(createdRows[0] as Record<string, unknown>),
        message: "Guard created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Guards POST error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to create guard", details: message },
      { status: 500 }
    );
  }
}
