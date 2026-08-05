import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/** GET /api/delivery-companies?search */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const pool: Pool = await getConnection();

    const conditions = ["1=1"];
    const params: unknown[] = [];

    if (search.trim()) {
      conditions.push("DeliveryCompanyName LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    const whereClause = conditions.join(" AND ");

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM DeliveryCompanies WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, DeliveryCompanyName, CreatedAt FROM DeliveryCompanies
       WHERE ${whereClause}
       ORDER BY DeliveryCompanyName ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const deliveryCompanies = rows.map((row) => ({
      id: row.Id,
      deliveryCompany: row.DeliveryCompanyName,
      createdAt: row.CreatedAt,
    }));

    return NextResponse.json({
      success: true,
      message: "Delivery companies retrieved successfully",
      data: deliveryCompanies,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/delivery-companies error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** POST /api/delivery-companies */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const deliveryCompany = String(body.deliveryCompany ?? "").trim();

    if (!deliveryCompany) {
      return NextResponse.json(
        { success: false, message: "Delivery company name is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [dupRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM DeliveryCompanies WHERE LOWER(DeliveryCompanyName) = LOWER(?) LIMIT 1",
      [deliveryCompany]
    );

    if (dupRows.length > 0) {
      return NextResponse.json(
        { success: false, message: "Delivery company already exists" },
        { status: 409 }
      );
    }

    const [insertResult] = await pool.query<ResultSetHeader>(
      "INSERT INTO DeliveryCompanies (DeliveryCompanyName) VALUES (?)",
      [deliveryCompany]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, DeliveryCompanyName, CreatedAt FROM DeliveryCompanies WHERE Id = ?",
      [insertResult.insertId]
    );

    const newRow = createdRows[0];

    return NextResponse.json(
      {
        success: true,
        message: "Delivery company created successfully",
        data: {
          id: newRow?.Id,
          deliveryCompany: newRow?.DeliveryCompanyName,
          createdAt: newRow?.CreatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/delivery-companies error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** DELETE /api/delivery-companies — legacy delete by id in body (prefer [id] route) */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Delivery company ID is required" },
        { status: 400 }
      );
    }

    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, message: "Invalid delivery company ID" }, { status: 400 });
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
    console.error("DELETE /api/delivery-companies error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
