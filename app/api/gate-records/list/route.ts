import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

const SELECT_COLS = `
  Id, PersonnelId, Name, VisitorReason, Type, EntryTime, ExitTime,
  DriverName, VehicleType, PlateNumber, VehicleArrivalReason, EmployeeExitReason,
  EmployeeCompany, EmployeeDepartment, \`Date\`, GuardId, GuardVerifiedAt, CreatedAt
`;

/** GET /api/gate-records/list — full gate record history */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "all";
    const search = searchParams.get("search") ?? "";

    const pool: Pool = await getConnection();

    const conditions: string[] = ["1=1"];
    const params: string[] = [];

    if (type && type !== "all" && ["employee", "visitor", "vehicle"].includes(type)) {
      conditions.push("Type = ?");
      params.push(type);
    }

    if (search.trim()) {
      const pattern = `%${search.trim()}%`;
      conditions.push(`(
        PersonnelId LIKE ? OR
        Name LIKE ? OR
        VisitorReason LIKE ? OR
        PlateNumber LIKE ? OR
        EmployeeCompany LIKE ? OR
        EmployeeDepartment LIKE ? OR
        DriverName LIKE ?
      )`);
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${SELECT_COLS}
       FROM GateRecords
       WHERE ${conditions.join(" AND ")}
       ORDER BY CreatedAt DESC`,
      params
    );

    const records = rows.map((r: Record<string, unknown>) => ({
      id: r.Id,
      personnelId: r.PersonnelId,
      name: r.Name,
      visitorReason: r.VisitorReason,
      type: r.Type,
      entryTime: r.EntryTime,
      exitTime: r.ExitTime ?? null,
      driverName: r.DriverName ?? null,
      vehicleType: r.VehicleType ?? null,
      plateNumber: r.PlateNumber ?? null,
      vehicleArrivalReason: r.VehicleArrivalReason ?? null,
      employeeExitReason: r.EmployeeExitReason ?? null,
      employeeCompany: r.EmployeeCompany ?? null,
      employeeDepartment: r.EmployeeDepartment ?? null,
      date: r.Date,
      guardId: r.GuardId ?? null,
      guardVerifiedAt: r.GuardVerifiedAt ?? null,
      createdAt: r.CreatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/gate-records/list error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to fetch gate records", details: msg },
      { status: 500 }
    );
  }
}
