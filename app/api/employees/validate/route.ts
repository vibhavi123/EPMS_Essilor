import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim();

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID is required",
        },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, EmployeeId, EmployeeName, EmployeeCompany, Department, IsActive, CreatedAt, UpdatedAt
       FROM Employees
       WHERE EmployeeId = ?
          OR TRIM(EmployeeId) = ?
          OR CAST(Id AS CHAR) = ?
       LIMIT 1`,
      [employeeId, employeeId, employeeId]
    );

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID not found",
        },
        { status: 404 }
      );
    }

    const emp = rows[0];

    return NextResponse.json(
      {
        success: true,
        message: "Employee ID validated",
        data: {
          id: emp.Id,
          employeeId: emp.EmployeeId,
          employeeName: emp.EmployeeName,
          employeeCompany: emp.EmployeeCompany,
          department: emp.Department,
          isActive: emp.IsActive,
          createdAt: emp.CreatedAt,
          updatedAt: emp.UpdatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Validate employee:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to validate employee",
      },
      { status: 500 }
    );
  }
}
