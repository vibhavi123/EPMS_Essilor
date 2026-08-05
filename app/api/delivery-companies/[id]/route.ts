import { NextRequest, NextResponse } from "next/server";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trimmedId = String(id ?? "").trim();

    if (!trimmedId) {
      return NextResponse.json(
        { success: false, message: "Delivery company ID is required" },
        { status: 400 }
      );
    }

    const numericId = Number(trimmedId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid delivery company ID" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM DeliveryCompanies WHERE Id = ?",
      [numericId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Delivery company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Delivery company deleted successfully" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/delivery-companies/[id] error:", msg);
    return NextResponse.json(
      { success: false, message: `Failed to delete: ${msg}` },
      { status: 500 }
    );
  }
}
