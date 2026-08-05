import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getRequestAccessContext } from "@/lib/server/accessControl";

export const dynamic = "force-dynamic";

const SELECT_COLS = `
  Id, PersonnelId, Name, VisitorReason, Type, EntryTime, ExitTime,
  DriverName, VehicleType, PlateNumber, VehicleArrivalReason, EmployeeExitReason,
  EmployeeCompany, EmployeeDepartment, \`Date\`, GuardId, GuardVerifiedAt, CreatedAt
`;

function mapRecord(r: Record<string, unknown>) {
  return {
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
  };
}

/** GET /api/gate-records — active records (no exit time yet) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const pool: Pool = await getConnection();

    let sql = `SELECT ${SELECT_COLS} FROM GateRecords WHERE ExitTime IS NULL`;
    const params: string[] = [];

    if (type && ["employee", "visitor", "vehicle"].includes(type)) {
      sql += " AND Type = ?";
      params.push(type);
    }

    sql += " ORDER BY CreatedAt DESC";

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const records = rows.map((r) => mapRecord(r as Record<string, unknown>));

    return NextResponse.json({ success: true, data: records, count: records.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/gate-records error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** POST /api/gate-records — create entry record */
export async function POST(request: NextRequest) {
  try {
    const accessContext = await getRequestAccessContext(request);
    if (!accessContext) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    if (
      !accessContext.permissions.entryExitRecording &&
      accessContext.session.role !== "superAdmin"
    ) {
      return NextResponse.json(
        { success: false, message: "Forbidden: missing permission to record entry" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      personnelId,
      name,
      visitorReason,
      type,
      entryTime,
      date,
      driverName,
      vehicleType,
      plateNumber,
      employeeCompany,
      employeeDepartment,
      vehicleArrivalReason,
      employeeExitReason,
    } = body;

    if (!personnelId || !type || !entryTime || !date) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: personnelId, type, entryTime, date" },
        { status: 400 }
      );
    }

    if (!["employee", "visitor", "vehicle"].includes(type)) {
      return NextResponse.json(
        { success: false, message: "Type must be employee, visitor, or vehicle" },
        { status: 400 }
      );
    }

    const pool: Pool = await getConnection();

    if (type === "employee") {
      const [dupRows] = await pool.query<RowDataPacket[]>(
        `SELECT Id FROM GateRecords
         WHERE PersonnelId = ? AND Type = 'employee' AND ExitTime IS NULL
         LIMIT 1`,
        [personnelId]
      );

      if (dupRows.length > 0) {
        return NextResponse.json(
          { success: false, message: "Employee already recorded as outside." },
          { status: 409 }
        );
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO GateRecords (
        PersonnelId, Name, VisitorReason, Type, EntryTime, \`Date\`,
        DriverName, VehicleType, PlateNumber, EmployeeCompany, EmployeeDepartment,
        VehicleArrivalReason, EmployeeExitReason, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
      [
        personnelId,
        name ?? null,
        visitorReason ?? null,
        type,
        entryTime,
        date,
        driverName ?? null,
        vehicleType ?? null,
        plateNumber ?? null,
        employeeCompany ?? null,
        employeeDepartment ?? null,
        vehicleArrivalReason ?? null,
        employeeExitReason ?? null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Gate record created successfully",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/gate-records error:", msg);
    return NextResponse.json(
      { success: false, message: "Failed to create gate record", details: msg },
      { status: 500 }
    );
  }
}
