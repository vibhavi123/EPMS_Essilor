import { NextRequest, NextResponse } from "next/server";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Guard ID is required" }, { status: 400 });
    }

    const pool = await getConnection();
    const numericId = Number(id);
    const isNumeric = Number.isInteger(numericId) && numericId > 0;

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Users
       SET IsActive = 0, UpdatedAt = NOW(6)
       WHERE Role = 'guard' AND (${isNumeric ? "Id = ? OR " : ""}AccessId = ?)`,
      isNumeric ? [numericId, id] : [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: "Guard not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Guard deleted successfully",
      deletedRecords: result.affectedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Guard DELETE error:", message);
    return NextResponse.json(
      { success: false, message: "Failed to delete guard", details: message },
      { status: 500 }
    );
  }
}
