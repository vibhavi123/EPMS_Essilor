import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { generateNextEmployeeId } from "@/lib/server/idSequenceGenerator";

// POST - Create a new employee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId: employeeIdInput, employeeName, employeeCompany, department } = body;

    if (!employeeName || !employeeName.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee name is required",
        },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const employeeId =
      String(employeeIdInput ?? "").trim() || (await generateNextEmployeeId(pool));

    const [existingRows] = await pool.query<RowDataPacket[]>(
      "SELECT Id FROM Employees WHERE EmployeeId = ? LIMIT 1",
      [employeeId]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID already exists",
        },
        { status: 409 }
      );
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO Employees (
        EmployeeId,
        EmployeeName,
        EmployeeCompany,
        Department,
        IsActive,
        CreatedAt,
        UpdatedAt
      ) VALUES (?, ?, ?, ?, 1, NOW(6), NOW(6))`,
      [
        employeeId,
        employeeName.trim(),
        employeeCompany?.trim() || null,
        department?.trim() || null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Employee created successfully",
        data: {
          employeeId,
          employeeName: employeeName.trim(),
          employeeCompany: employeeCompany?.trim() || null,
          department: department?.trim() || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Failed to create employee:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create employee. Please try again.",
      },
      { status: 500 }
    );
  }
}

// GET - Retrieve all employees
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const company = searchParams.get("company")?.trim() || "";
    const department = searchParams.get("department")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const pool: Pool = await getConnection();

    const conditions = ["IsActive = 1"];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(EmployeeName LIKE ? OR EmployeeId LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (company) {
      conditions.push("EmployeeCompany = ?");
      params.push(company);
    }

    if (department) {
      conditions.push("Department = ?");
      params.push(department);
    }

    const whereClause = conditions.join(" AND ");

    const [empRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM Employees
       WHERE ${whereClause}
       ORDER BY EmployeeName ASC`,
      params
    );

    // Also include users created via User Management so they appear in employee selection & suggestions
    const userConditions = ["IsActive = 1", "FullName IS NOT NULL", "FullName != ''"];
    const userParams: unknown[] = [];
    if (search) {
      userConditions.push("(FullName LIKE ? OR AccessId LIKE ? OR Username LIKE ?)");
      userParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (company) {
      userConditions.push("Company = ?");
      userParams.push(company);
    }
    if (department) {
      userConditions.push("Department = ?");
      userParams.push(department);
    }

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT Id, AccessId AS EmployeeId, FullName AS EmployeeName, Company AS EmployeeCompany, Department, IsActive, CreatedAt, UpdatedAt
       FROM Users
       WHERE ${userConditions.join(" AND ")}
       ORDER BY FullName ASC`,
      userParams
    );

    const empNamesSet = new Set(
      empRows.map((e) => (String(e.EmployeeName || "").trim().toLowerCase()))
    );

    const combinedRows = [
      ...empRows,
      ...userRows.filter(
        (u) => !empNamesSet.has(String(u.EmployeeName || "").trim().toLowerCase())
      ),
    ];

    const total = combinedRows.length;
    const paginatedRows = combinedRows.slice(offset, offset + limit);

    const employees = paginatedRows.map((emp) => ({
      id: emp.Id,
      employeeId: emp.EmployeeId,
      employeeName: emp.EmployeeName,
      employeeCompany: emp.EmployeeCompany,
      department: emp.Department,
      isActive: emp.IsActive,
      createdAt: emp.CreatedAt,
      updatedAt: emp.UpdatedAt,
    }));

    return NextResponse.json(
      {
        success: true,
        message: "Employees retrieved successfully",
        data: employees,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Failed to retrieve employees:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve employees. Please try again.",
      },
      { status: 500 }
    );
  }
}
