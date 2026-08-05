import type { Pool, RowDataPacket } from "mysql2/promise";

function generateChecksum(input: string): string {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input.charCodeAt(i);
  }
  return (sum % 10).toString();
}

/**
 * Atomically increment a named counter using a MySQL transaction.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for concurrency-safe upsert.
 */
async function reserveCounterValue(
  pool: Pool,
  counterName: string
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert: insert with value 1 on first call, increment on subsequent calls
    await conn.query(
      `INSERT INTO IdCounters (CounterName, CounterValue, UpdatedAt)
       VALUES (?, 1, NOW(6))
       ON DUPLICATE KEY UPDATE
         CounterValue = CounterValue + 1,
         UpdatedAt    = NOW(6)`,
      [counterName]
    );

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT CounterValue FROM IdCounters WHERE CounterName = ? FOR UPDATE",
      [counterName]
    );

    await conn.commit();

    if (!rows || rows.length === 0) {
      throw new Error(`Counter row not found after upsert for: ${counterName}`);
    }

    return Number(rows[0].CounterValue);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function generateNextAccessId(
  pool: Pool,
  userType: string = "guard"
): Promise<string> {
  const normalizedType = userType.toLowerCase();
  const rolePrefix =
    ({
      admin: "ADM",
      superadmin: "SUP",
      guard: "GRD",
      employee: "EMP",
    } as Record<string, string>)[normalizedType] || "USR";

  const now = new Date();
  const yearMonth =
    now.getFullYear().toString().slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0");
  const counterValue = await reserveCounterValue(pool, "accessIdCounter");
  const sequentialPart = String(counterValue).padStart(4, "0");
  const randomPart = Math.floor(Math.random() * 900) + 100;
  const baseId = `${rolePrefix}${yearMonth}${sequentialPart}${randomPart}`;

  return `${baseId}${generateChecksum(baseId)}`;
}

export async function generateNextEmployeeId(pool: Pool): Promise<string> {
  const now = new Date();
  const yearMonth =
    now.getFullYear().toString().slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0");
  const counterValue = await reserveCounterValue(pool, "employeeIdCounter");
  const sequentialPart = String(counterValue).padStart(5, "0");
  const randomPart = Math.floor(Math.random() * 90) + 10;
  const baseId = `EMP${yearMonth}${sequentialPart}${randomPart}`;

  return `${baseId}${generateChecksum(baseId)}`;
}

export async function generateNextReferenceNumber(pool: Pool): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const dateString = `${year}${month}${date}`;
  const currentTimeString = `${hours}${minutes}`;
  const counterValue = await reserveCounterValue(pool, `referenceNumber:${dateString}`);
  const paddedCounter = String(counterValue).padStart(5, "0");

  return `${dateString}-${currentTimeString}-${paddedCounter}`;
}