import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { hashPassword, normalizeRole, validatePassword } from "@/lib/auth";
import { getRequestAccessContext } from "@/lib/server/accessControl";

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.Id,
    accessId: row.AccessId ?? "",
    username: row.Username,
    fullName: row.FullName,
    role: row.Role,
    department: row.Department ?? null,
    company: row.Company ?? null,
    isActive: Boolean(row.IsActive),
    createdAt: row.CreatedAt ? new Date(row.CreatedAt as string).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt as string).toISOString() : null,
  };
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "Invalid user id" }, { status: 400 });
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId, Username, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt
       FROM Users WHERE Id = ?`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: mapUser(rows[0] as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: "Failed to load user", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, message: "Access denied: edit/control permission required" },
        { status: 403 }
      );
    }

    const { id: idParam } = await params;
    const id = Number(idParam);
    const body = await request.json();

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "Invalid user id" }, { status: 400 });
    }

    if (accessContext.userId === id) {
      if (Object.prototype.hasOwnProperty.call(body, "role")) {
        return NextResponse.json(
          { success: false, message: "Forbidden: cannot change your own role" },
          { status: 403 }
        );
      }
      if (Object.prototype.hasOwnProperty.call(body, "isActive") && body.isActive === false) {
        return NextResponse.json(
          { success: false, message: "Forbidden: cannot deactivate your own account" },
          { status: 403 }
        );
      }
    }

    const pool: Pool = await getConnection();
    const updates: string[] = [];
    const queryParams: unknown[] = [];

    if (typeof body.isActive === "boolean") {
      updates.push("IsActive = ?");
      queryParams.push(body.isActive ? 1 : 0);
    }

    if (Object.prototype.hasOwnProperty.call(body, "username")) {
      const username = String(body.username ?? "").trim();
      if (!username) {
        return NextResponse.json({ success: false, message: "Username is required" }, { status: 400 });
      }
      const [dupRows] = await pool.query<RowDataPacket[]>(
        "SELECT Id FROM Users WHERE REPLACE(LOWER(Username), ' ', '') = REPLACE(LOWER(?), ' ', '') AND Id <> ? LIMIT 1",
        [username, id]
      );
      if (dupRows.length > 0) {
        return NextResponse.json({ success: false, message: "Username already exists" }, { status: 409 });
      }
      updates.push("Username = ?");
      queryParams.push(username);
    }

    if (Object.prototype.hasOwnProperty.call(body, "fullName")) {
      const fullName = String(body.fullName ?? "").trim();
      if (!fullName) {
        return NextResponse.json({ success: false, message: "Full name is required" }, { status: 400 });
      }
      const [dupNameRows] = await pool.query<RowDataPacket[]>(
        "SELECT Id FROM Users WHERE REPLACE(LOWER(FullName), ' ', '') = REPLACE(LOWER(?), ' ', '') AND Id <> ? LIMIT 1",
        [fullName, id]
      );
      if (dupNameRows.length > 0) {
        return NextResponse.json({ success: false, message: "Full Name already exists" }, { status: 409 });
      }
      updates.push("FullName = ?");
      queryParams.push(fullName);
    }

    if (Object.prototype.hasOwnProperty.call(body, "department")) {
      updates.push("Department = ?");
      queryParams.push(String(body.department ?? "").trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(body, "company")) {
      updates.push("Company = ?");
      queryParams.push(String(body.company ?? "").trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(body, "role")) {
      updates.push("Role = ?");
      queryParams.push(normalizeRole(body.role));
    }

    if (Object.prototype.hasOwnProperty.call(body, "password")) {
      const password = String(body.password ?? "").trim();
      if (password) {
        const passValidation = validatePassword(password);
        if (!passValidation.valid) {
          return NextResponse.json(
            { success: false, message: passValidation.message },
            { status: 400 }
          );
        }
        updates.push("PasswordHash = ?");
        queryParams.push(await hashPassword(password));
      }
    }

    if (!updates.length) {
      return NextResponse.json(
        { success: false, message: "No valid update fields provided" },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE Users SET ${updates.join(", ")}, UpdatedAt = NOW(6) WHERE Id = ?`,
      [...queryParams, id]
    );

    const [updatedRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId, Username, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt
       FROM Users WHERE Id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: body.isActive === false ? "User deactivated successfully" : "User updated successfully",
      data: mapUser(updatedRows[0] as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: "Failed to update user", details: message },
      { status: 500 }
    );
  }
}
