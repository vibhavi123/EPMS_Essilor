import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export const dynamic = "force-dynamic";

/** PATCH /api/gate-records/exit — record exit for an active gate record */
export async function PATCH(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    if (
      !accessContext.permissions.entryExitRecording &&
      accessContext.session.role !== "superAdmin"
    ) {
      return NextResponse.json(
        { success: false, message: "Forbidden: missing permission to record exit" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const numericId = Number(body?.id);
    const guardId = String(body?.guardId ?? "").trim();
    const providedExitTime = String(body?.exitTime ?? "").trim();
    const exitTime =
      providedExitTime ||
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

    if (!Number.isInteger(numericId) || numericId <= 0 || !guardId || !exitTime) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: id, exitTime, guardId" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [checkRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, ExitTime, Type FROM GateRecords WHERE Id = ?",
      [numericId]
    );

    if (checkRows.length === 0) {
      return NextResponse.json({ success: false, message: "Gate record not found" }, { status: 404 });
    }

    if (checkRows[0].ExitTime) {
      return NextResponse.json(
        { success: false, message: "This record already has an exit time recorded" },
        { status: 409 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE GateRecords
       SET ExitTime = ?, GuardId = ?, GuardVerifiedAt = NOW(6), UpdatedAt = NOW(6)
       WHERE Id = ?`,
      [exitTime, guardId, numericId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: "Gate record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Exit recorded successfully" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/gate-records/exit error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to record exit", details: msg },
      { status: 500 }
    );
  }
}
