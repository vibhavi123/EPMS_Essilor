import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export const dynamic = "force-dynamic";

/** GET /api/admin/login-monitor — list all login sessions */
export async function GET(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const role = String(accessContext.session.role || "");
    const canView =
      role === "admin" ||
      role === "superAdmin" ||
      accessContext.permissions?.accessManagementControl;

    if (!canView) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const pool: Pool = await getConnection();

    let rows: RowDataPacket[] = [];
    try {
      const [result] = await pool.query<RowDataPacket[]>(`
        SELECT
          ls.Id, ls.UserId, u.Username, u.FullName, u.Role,
          ls.IpAddress, ls.UserAgent, ls.LoginAt, ls.LogoutAt, ls.IsActive, ls.RememberMe
        FROM LoginSessions ls
        LEFT JOIN Users u ON ls.UserId = u.Id
        ORDER BY ls.LoginAt DESC
      `);
      rows = result;
    } catch (err: unknown) {
      const sqlErr = err as { code?: string; errno?: number };
      if (sqlErr?.code === "ER_BAD_FIELD_ERROR" || sqlErr?.errno === 1054) {
        // Production DB does not have RememberMe column yet — attempt auto-add & fallback to query without it
        try {
          await pool.query("ALTER TABLE LoginSessions ADD COLUMN RememberMe TINYINT(1) NOT NULL DEFAULT 0");
        } catch {
          // ignore alter failure if DB user lacks DDL privileges
        }

        const [result] = await pool.query<RowDataPacket[]>(`
          SELECT
            ls.Id, ls.UserId, u.Username, u.FullName, u.Role,
            ls.IpAddress, ls.UserAgent, ls.LoginAt, ls.LogoutAt, ls.IsActive,
            0 AS RememberMe
          FROM LoginSessions ls
          LEFT JOIN Users u ON ls.UserId = u.Id
          ORDER BY ls.LoginAt DESC
        `);
        rows = result;
      } else {
        throw err;
      }
    }

    const TTL = 8 * 60 * 60 * 1000;           // 8 hours (normal session)
    const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (remember me)
    const now = Date.now();

    const data = rows.map((r) => {
      const loginAtRaw = r.LoginAt ? new Date(r.LoginAt as string) : null;
      const loginAtTime = loginAtRaw && !isNaN(loginAtRaw.getTime()) ? loginAtRaw.getTime() : null;
      
      const rememberMe = Boolean(r.RememberMe);
      const sessionDuration = rememberMe ? REMEMBER_TTL : TTL;
      const isExpired = loginAtTime ? now - loginAtTime > sessionDuration : false;

      const dbIsActive = Boolean(r.IsActive);
      const logoutAt = r.LogoutAt ? new Date(r.LogoutAt as string).toISOString() : null;

      let sessionStatus = "active";
      if (logoutAt) sessionStatus = "logged_out";
      else if (isExpired) sessionStatus = "expired";
      else if (!dbIsActive) sessionStatus = "revoked";

      const isActive = dbIsActive && !logoutAt && !isExpired;

      return {
        id: r.Id,
        userId: r.UserId,
        username: r.Username ?? "Unknown",
        fullName: r.FullName ?? r.Username ?? "Unknown",
        role: r.Role ?? "user",
        ipAddress: r.IpAddress ?? "Unknown",
        userAgent: r.UserAgent ?? null,
        loginAt: loginAtRaw && !isNaN(loginAtRaw.getTime()) ? loginAtRaw.toISOString() : null,
        logoutAt,
        rememberMe,
        isActive,
        sessionStatus,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Login monitor GET error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to load sessions", details: message },
      { status: 500 }
    );
  }
}

