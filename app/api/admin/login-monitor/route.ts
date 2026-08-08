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
    if (role !== "admin" && role !== "superAdmin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        ls.Id, ls.UserId, u.Username, u.FullName, u.Role,
        ls.IpAddress, ls.UserAgent, ls.LoginAt, ls.LogoutAt, ls.IsActive, ls.RememberMe
      FROM LoginSessions ls
      LEFT JOIN Users u ON ls.UserId = u.Id
      ORDER BY ls.LoginAt DESC
    `);

    const TTL = 8 * 60 * 60 * 1000;           // 8 hours (normal session)
    const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (remember me)

    const data = rows.map((r) => {
      const loginAt = new Date(r.LoginAt as string).getTime();
      const now = Date.now();
      const sessionDuration = r.RememberMe ? REMEMBER_TTL : TTL;
      const isExpired = now - loginAt > sessionDuration;
      
      const isActive = Boolean(r.IsActive) && !r.LogoutAt && !isExpired;
      let sessionStatus = "active";
      if (r.LogoutAt) sessionStatus = "logged_out";
      else if (isExpired) sessionStatus = "expired";
      else if (!r.IsActive) sessionStatus = "revoked";

      return {
        id: r.Id,
        userId: r.UserId,
        username: r.Username,
        fullName: r.FullName,
        role: r.Role,
        ipAddress: r.IpAddress ?? "Unknown",
        userAgent: r.UserAgent ?? null,
        loginAt: r.LoginAt ? new Date(r.LoginAt as string).toISOString() : null,
        logoutAt: r.LogoutAt ? new Date(r.LogoutAt as string).toISOString() : null,
        isActive,
        sessionStatus
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
