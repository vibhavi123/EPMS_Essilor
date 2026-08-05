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

// GET /api/package-descriptions?search=term&limit=100&offset=0
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
      conditions.push("PackageDescription LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    const whereClause = conditions.join(" AND ");

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM PackageDescriptions WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, PackageDescription, CreatedAt FROM PackageDescriptions
       WHERE ${whereClause}
       ORDER BY PackageDescription ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const descriptions = rows.map((row) => ({
      id: row.Id,
      packageDescription: row.PackageDescription,
      createdAt: row.CreatedAt,
    }));

    return NextResponse.json({
      success: true,
      message: "Package descriptions retrieved successfully",
      data: descriptions,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/package-descriptions error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// POST /api/package-descriptions
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const { packageDescription } = body;

    if (!packageDescription || !packageDescription.trim()) {
      return NextResponse.json(
        { success: false, message: "Package description is required" },
        { status: 400 }
      );
    }

    const trimmed = packageDescription.trim();
    const pool: Pool = await getConnection();

    const [dupRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM PackageDescriptions WHERE LOWER(PackageDescription) = LOWER(?) LIMIT 1",
      [trimmed]
    );

    if (dupRows.length > 0) {
      return NextResponse.json(
        { success: false, message: "Package description already exists" },
        { status: 409 }
      );
    }

    const [insertResult] = await pool.query<ResultSetHeader>(
      "INSERT INTO PackageDescriptions (PackageDescription) VALUES (?)",
      [trimmed]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id, PackageDescription, CreatedAt FROM PackageDescriptions WHERE Id = ?",
      [insertResult.insertId]
    );

    const newDescription = createdRows[0];

    return NextResponse.json(
      {
        success: true,
        message: "Package description created successfully",
        data: {
          id: newDescription?.Id,
          packageDescription: newDescription?.PackageDescription,
          createdAt: newDescription?.CreatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/package-descriptions error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// DELETE /api/package-descriptions?id=...
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Package description ID is required" },
        { status: 400 }
      );
    }

    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid package description ID" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM PackageDescriptions WHERE Id = ?",
      [numericId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Package description not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Package description deleted successfully",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/package-descriptions error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
