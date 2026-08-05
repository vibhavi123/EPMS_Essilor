import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import {
  createAuthToken,
  getAuthCookieName,
  getRoleLandingPath,
  normalizeRole,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const rememberMe = Boolean(body.rememberMe);

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, Username, PasswordHash, FullName, Role, Department, Company, IsActive
       FROM Users WHERE Username = ? LIMIT 1`,
      [username]
    );

    const user = rows[0];
    if (!user || !user.IsActive) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(password, String(user.PasswordHash));
    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    let ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    if (ipAddress === "::1") ipAddress = "127.0.0.1";
    const userAgent = request.headers.get("user-agent") ?? null;

    let sessionId: number | undefined;
    try {
      const [sessionResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO LoginSessions (UserId, IpAddress, UserAgent, LoginAt, IsActive)
         VALUES (?, ?, ?, NOW(), 1)`,
        [user.Id, ipAddress, userAgent]
      );
      sessionId = sessionResult.insertId;
    } catch (sessionErr) {
      console.warn("Failed to record login session:", sessionErr);
    }

    const role = normalizeRole(String(user.Role));

    const authToken = await createAuthToken({
      id: Number(user.Id),
      sessionId,
      username: String(user.Username),
      role,
      fullName: String(user.FullName),
      expiresInSeconds: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    });

    let redirectTo = getRoleLandingPath(role);

    try {
      const [accessRows] = await pool.query<RowDataPacket[]>(
        "SELECT AccessId FROM Users WHERE Id = ? LIMIT 1",
        [user.Id]
      );
      const accessId = accessRows[0]?.AccessId as string | undefined;

      if (accessId) {
        const [permRows] = await pool.query<RowDataPacket[]>(
          "SELECT * FROM UserPermissions WHERE AccessId = ? LIMIT 1",
          [accessId]
        );
        const p = permRows[0] as Record<string, unknown> | undefined;

        if (p) {
          if (p.AddOngoingPackage) redirectTo = "/pages/OutgoingPackage";
          else if (p.AddIncomePackage) redirectTo = "/pages/IncomingPackage";
          else if (p.AllPackagesView) redirectTo = "/pages/AllPackage";
          else if (p.OutgoingVerification) redirectTo = "/pages/OutgoingPackageVerification";
          else if (p.IncomeVerification) redirectTo = "/pages/IncomingPackageVerification";
          else if (p.VerifyHoldingPackages) redirectTo = "/pages/VerifyHoldingPackages";
          else if (p.EntryExitRecording) redirectTo = "/pages/EntryExitRecording";
          else if (p.ReportAccess) redirectTo = "/pages/Report";
          else if (user.Role === "admin" || user.Role === "superAdmin") redirectTo = "/Admin/AllUsers";
        }
      }
    } catch (err) {
      console.warn("Failed to resolve permissions for redirect:", err);
    }

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      data: {
        id: user.Id,
        username: user.Username,
        fullName: user.FullName,
        role: user.Role,
        department: user.Department,
        company: user.Company,
        redirectTo,
      },
    });

    response.cookies.set({
      name: getAuthCookieName(),
      value: authToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Login error:", message);
    return NextResponse.json(
      { success: false, message: "Login failed", details: message },
      { status: 500 }
    );
  }
}
