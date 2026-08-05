import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const accessId = request.nextUrl.searchParams.get("accessId")?.trim();

    if (!accessId) {
      return NextResponse.json({ success: false, message: "Access ID is required" }, { status: 400 });
    }

    const pool: Pool = await getConnection();
    const numericId = Number(accessId);
    const isNumeric = Number.isInteger(numericId) && numericId > 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId, FullName, Company, Department, IsActive, CreatedAt, UpdatedAt
       FROM Users
       WHERE Role = 'guard'
         AND (AccessId = ? OR TRIM(AccessId) = ?${isNumeric ? " OR Id = ?" : ""})
       LIMIT 1`,
      isNumeric ? [accessId, accessId, numericId] : [accessId, accessId]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: "Guard ID not found" }, { status: 404 });
    }

    const g = rows[0];

    return NextResponse.json({
      success: true,
      message: "Guard validated",
      data: {
        id: g.Id,
        accessId: g.AccessId,
        guardName: g.FullName,
        guardCompany: g.Company,
        department: g.Department,
        isActive: g.IsActive,
        createdAt: g.CreatedAt,
        updatedAt: g.UpdatedAt,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Validate guard:", errorMessage);
    return NextResponse.json({ success: false, message: "Failed to validate guard" }, { status: 500 });
  }
}
