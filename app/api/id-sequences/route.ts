import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import {
  generateNextAccessId,
  generateNextEmployeeId,
  generateNextReferenceNumber,
} from "@/lib/server/idSequenceGenerator";

type IdSequenceKind = "accessId" | "employeeId" | "referenceNumber";

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind") as IdSequenceKind | null;
    const role = request.nextUrl.searchParams.get("role") || "guard";

    if (!kind || !["accessId", "employeeId", "referenceNumber"].includes(kind)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or missing id sequence kind",
        },
        { status: 400 }
      );
    }

    const pool = await getConnection();

    let data: Record<string, string>;
    if (kind === "accessId") {
      data = { accessId: await generateNextAccessId(pool, role) };
    } else if (kind === "employeeId") {
      data = { employeeId: await generateNextEmployeeId(pool) };
    } else {
      data = { referenceNumber: await generateNextReferenceNumber(pool) };
    }

    return NextResponse.json(
      {
        success: true,
        message: "ID sequence generated",
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API Error - Generate ID sequence:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate ID sequence",
      },
      { status: 500 }
    );
  }
}