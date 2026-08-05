import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export const dynamic = "force-dynamic";

const DEFAULT_OVERDUE_HOURS = 8;

/** GET — current OVERDUE_HOURS (defaults to 8 if not configured) */
export async function GET() {
  try {
    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT `Value` FROM AppSettings WHERE `Key` = 'OVERDUE_HOURS' LIMIT 1"
    );

    const stored = rows[0]?.Value;
    const value =
      stored !== null && stored !== undefined && String(stored).trim() !== ""
        ? String(stored)
        : String(DEFAULT_OVERDUE_HOURS);

    return NextResponse.json({ success: true, value });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/admin/overdue error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** PUT — update OVERDUE_HOURS (admin / superAdmin) */
export async function PUT(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const role = String(accessContext.session.role || "");
    const canManage =
      role === "superAdmin" ||
      role === "admin" ||
      accessContext.permissions.accessManagementControl ||
      accessContext.permissions.overdueEmployeeAlert;

    if (!canManage) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const numeric = parseInt(String(body?.value ?? ""), 10);
    if (Number.isNaN(numeric) || numeric <= 0) {
      return NextResponse.json({ success: false, message: "Invalid overdue hours" }, { status: 400 });
    }

    const pool: Pool = await getConnection();
    await pool.query(
      `INSERT INTO AppSettings (\`Key\`, \`Value\`)
       VALUES ('OVERDUE_HOURS', ?)
       ON DUPLICATE KEY UPDATE \`Value\` = VALUES(\`Value\`)`,
      [String(numeric)]
    );

    return NextResponse.json({
      success: true,
      message: "Updated OVERDUE_HOURS",
      value: numeric,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PUT /api/admin/overdue error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** POST — verify admin password for overdue alert acknowledgements */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "").trim();

    if (!password) {
      return NextResponse.json({ success: false, message: "Password is required" }, { status: 400 });
    }

    const accessContext = await getRequestAccessContext(request);
    if (!accessContext?.session) {
      return NextResponse.json({ success: false, message: "User not authenticated" }, { status: 401 });
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, AccessId, FullName, Role, IsActive, PasswordHash FROM Users WHERE Id = ? LIMIT 1",
      [Number(accessContext.session.sub)]
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (!user.IsActive) {
      return NextResponse.json({ success: false, message: "User is inactive" }, { status: 403 });
    }

    const role = String(user.Role ?? "");
    if (role !== "admin" && role !== "superAdmin") {
      return NextResponse.json(
        { success: false, message: "Only admin or super admin can acknowledge overdue alerts" },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(password, String(user.PasswordHash));
    if (!passwordValid) {
      return NextResponse.json({ success: false, message: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.Id,
        accessId: user.AccessId,
        fullName: user.FullName,
        role,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/admin/overdue error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
