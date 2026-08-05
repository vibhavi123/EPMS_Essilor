import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trimmedId = String(id ?? "").trim();
    const pool: Pool = await getConnection();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM Employees
       WHERE EmployeeId = ?
          OR TRIM(EmployeeId) = ?
          OR CAST(Id AS CHAR) = ?
       LIMIT 1`,
      [trimmedId, trimmedId, trimmedId]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    const emp = rows[0];
    const data = {
      id: emp.Id,
      employeeId: emp.EmployeeId,
      employeeName: emp.EmployeeName,
      employeeCompany: emp.EmployeeCompany,
      department: emp.Department,
      isActive: emp.IsActive,
      createdAt: emp.CreatedAt,
      updatedAt: emp.UpdatedAt,
    };

    return NextResponse.json({ success: true, message: "Employee retrieved", data }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API Error - GET employee:", errorMessage);
    return NextResponse.json({ success: false, message: "Failed to retrieve employee" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { employeeName, employeeCompany, department } = body;

    if (!employeeName && !employeeCompany && !department) {
      return NextResponse.json({ success: false, message: "No fields to update" }, { status: 400 });
    }

    const pool: Pool = await getConnection();
    const updates: string[] = [];
    const queryParams: unknown[] = [];

    if (employeeName !== undefined) {
      updates.push("EmployeeName = ?");
      queryParams.push(String(employeeName).trim());
    }
    if (employeeCompany !== undefined) {
      updates.push("EmployeeCompany = ?");
      queryParams.push(employeeCompany ? String(employeeCompany).trim() : null);
    }
    if (department !== undefined) {
      updates.push("Department = ?");
      queryParams.push(department ? String(department).trim() : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: "No valid update fields provided" }, { status: 400 });
    }

    const numericId = Number(id);
    const isNumeric = Number.isInteger(numericId) && numericId > 0;
    const whereClause = isNumeric ? "(Id = ? OR EmployeeId = ?)" : "EmployeeId = ?";
    const whereParams = isNumeric ? [numericId, id] : [id];

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Employees SET ${updates.join(", ")}, UpdatedAt = NOW(6) WHERE ${whereClause}`,
      [...queryParams, ...whereParams]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Employee updated" }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API Error - PUT employee:", errorMessage);
    return NextResponse.json({ success: false, message: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Employee ID is required" }, { status: 400 });
    }

    const pool: Pool = await getConnection();
    const numericId = Number(id);
    const isNumeric = Number.isInteger(numericId) && numericId > 0;

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Employees
       SET IsActive = 0, UpdatedAt = NOW(6)
       WHERE ${isNumeric ? "Id = ? OR " : ""}EmployeeId = ?`,
      isNumeric ? [numericId, id] : [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Employee deleted successfully",
      deletedRecords: result.affectedRows,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API Error - DELETE employee:", errorMessage);
    return NextResponse.json(
      { success: false, message: "Failed to delete employee", details: errorMessage },
      { status: 500 }
    );
  }
}
