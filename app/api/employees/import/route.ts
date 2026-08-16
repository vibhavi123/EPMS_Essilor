import { NextRequest, NextResponse } from "next/server";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConnection } from "@/lib/db";
import { generateNextEmployeeId } from "@/lib/server/idSequenceGenerator";

export const dynamic = "force-dynamic";

interface ImportRowInput {
  employeeName?: string;
  employeeCompany?: string;
  department?: string;
}

interface ImportRowResult {
  row: number;
  employeeName: string;
  company: string;
  department: string;
  status: "Imported" | "Skipped" | "Failed";
  employeeId?: string;
  reason?: string;
}

/** POST /api/employees/import — Batch import employees from CSV data */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: ImportRowInput[] = Array.isArray(body.employees) ? body.employees : [];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No employee data provided for import",
        },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();
    const results: ImportRowResult[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const raw = rows[i] || {};
      const name = String(raw.employeeName ?? "").trim();
      const company = String(raw.employeeCompany ?? "").trim();
      const department = String(raw.department ?? "").trim();

      // Row Validation
      if (!name) {
        results.push({
          row: rowNum,
          employeeName: name || "(Empty)",
          company,
          department,
          status: "Failed",
          reason: "Employee Name is required",
        });
        failedCount++;
        continue;
      }

      // Check if employee with matching name & company (ignoring spaces & case) already exists
      const [existingRows] = await pool.query<RowDataPacket[]>(
        `SELECT Id, EmployeeId FROM Employees 
         WHERE REPLACE(LOWER(EmployeeName), ' ', '') = REPLACE(LOWER(?), ' ', '') 
           AND (REPLACE(LOWER(COALESCE(EmployeeCompany, '')), ' ', '') = REPLACE(LOWER(?), ' ', '') OR (EmployeeCompany IS NULL AND ? = ''))
           AND IsActive = 1 
         LIMIT 1`,
        [name, company, company]
      );

      if (existingRows.length > 0) {
        results.push({
          row: rowNum,
          employeeName: name,
          company: company || "-",
          department: department || "-",
          status: "Skipped",
          employeeId: existingRows[0].EmployeeId,
          reason: "Employee already exists",
        });
        skippedCount++;
        continue;
      }

      // Generate next Employee ID using the existing system logic
      try {
        const newEmployeeId = await generateNextEmployeeId(pool);

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
            newEmployeeId,
            name,
            company || null,
            department || null,
          ]
        );

        results.push({
          row: rowNum,
          employeeName: name,
          company: company || "-",
          department: department || "-",
          status: "Imported",
          employeeId: newEmployeeId,
        });
        importedCount++;
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : "Database insert failed";
        results.push({
          row: rowNum,
          employeeName: name,
          company: company || "-",
          department: department || "-",
          status: "Failed",
          reason: msg,
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete. ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed.`,
      summary: {
        total: rows.length,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Employee CSV Import:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process employee CSV import. " + errorMessage,
      },
      { status: 500 }
    );
  }
}
