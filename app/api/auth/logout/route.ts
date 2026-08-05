import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieName, verifyAuthToken } from "@/lib/auth";
import { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(getAuthCookieName())?.value;
    if (token) {
      const session = await verifyAuthToken(token);
      if (session?.sessionId) {
        const pool = await getConnection();
        await pool.query(
          "UPDATE LoginSessions SET IsActive = 0, LogoutAt = NOW() WHERE Id = ?",
          [session.sessionId]
        );
      }
    }
  } catch (error) {
    console.warn("Failed to mark session as logged out in DB:", error);
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });

  response.cookies.set({
    name: getAuthCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
