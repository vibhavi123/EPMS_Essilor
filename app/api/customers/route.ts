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

/** GET /api/customers?search */
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
      conditions.push("CustomerName LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    const whereClause = conditions.join(" AND ");

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM Customers WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, CustomerName, CreatedAt FROM Customers
       WHERE ${whereClause}
       ORDER BY CustomerName ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const customers = rows.map((row) => ({
      id: row.Id,
      customerName: row.CustomerName,
      createdAt: row.CreatedAt,
    }));

    return NextResponse.json({
      success: true,
      message: "Customers retrieved successfully",
      data: customers,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/customers error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** POST /api/customers */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const customerName = String(body.customerName ?? "").trim();

    if (!customerName) {
      return NextResponse.json(
        { success: false, message: "Customer name is required" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    const [dupRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Customers WHERE LOWER(CustomerName) = LOWER(?) LIMIT 1",
      [customerName]
    );

    if (dupRows.length > 0) {
      return NextResponse.json(
        { success: false, message: "Customer already exists" },
        { status: 409 }
      );
    }

    const [insertResult] = await pool.query<ResultSetHeader>(
      "INSERT INTO Customers (CustomerName) VALUES (?)",
      [customerName]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, CustomerName, CreatedAt FROM Customers WHERE Id = ?",
      [insertResult.insertId]
    );

    const newCustomer = createdRows[0];

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully",
        data: {
          id: newCustomer?.Id,
          customerName: newCustomer?.CustomerName,
          createdAt: newCustomer?.CreatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/customers error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
