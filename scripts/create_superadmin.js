/**

 * Defaults:
 *   username = testsup@123
 *   password = testsup@123
 *   fullName = Test Super Admin
 *   default commmand= node scripts/create_superadmin.js
 *   create a own superadmin=node scripts/create_superadmin.js <username> <password> "<Full Name>"
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { webcrypto } = require("crypto");

const USERNAME = process.argv[2] || "testsup@123";
const PASSWORD = process.argv[3] || "testsup@123";
const FULL_NAME = process.argv[4] || "Test Super Admin";
const ROLE = "superAdmin";

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await webcrypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, 100000);
  return `pbkdf2$100000$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, iterationsText, saltText, hashText] = String(storedHash).split("$");
  if (algorithm !== "pbkdf2" || !iterationsText || !saltText || !hashText) return false;

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const expected = base64UrlDecode(hashText);
  const actual = await deriveBits(password, base64UrlDecode(saltText), iterations);
  if (expected.length !== actual.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// Same rule as validatePassword() in lib/auth.ts
function validatePassword(password) {
  if (!password || password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[^a-zA-Z0-9]/.test(password)) return "Password must contain at least one special character.";
  return null;
}

function generateChecksum(input) {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input.charCodeAt(i);
  return (sum % 10).toString();
}

async function generateSuperAdminAccessId(conn) {
  await conn.query(
    `INSERT INTO IdCounters (CounterName, CounterValue, UpdatedAt)
     VALUES ('accessIdCounter', 1, NOW(6))
     ON DUPLICATE KEY UPDATE CounterValue = CounterValue + 1, UpdatedAt = NOW(6)`
  );
  const [rows] = await conn.query(
    "SELECT CounterValue FROM IdCounters WHERE CounterName = 'accessIdCounter' FOR UPDATE"
  );
  const counterValue = Number(rows[0].CounterValue);

  const now = new Date();
  const yearMonth = now.getFullYear().toString().slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const sequentialPart = String(counterValue).padStart(4, "0");
  const randomPart = Math.floor(Math.random() * 900) + 100;
  const baseId = `SUP${yearMonth}${sequentialPart}${randomPart}`;
  return `${baseId}${generateChecksum(baseId)}`;
}

// Full permissions row for the superAdmin
const PERMISSION_COLUMNS = [
  "AddOngoingPackage",
  "AddIncomePackage",
  "AllPackagesView",
  "AllPackagesEdit",
  "AllPackagesDelete",
  "OutgoingVerification",
  "IncomeVerification",
  "AccessManagementAdd",
  "AccessManagementEdit",
  "AccessManagementControl",
  "LoginMonitoring",
  "ReportAccess",
  "EntryExitRecording",
  "VerifyHoldingPackages",
  "OverdueEmployeeAlert",
  "GuardManagementAdd",
  "GuardManagementEdit",
  "GuardManagementDelete",
  "GuardManagementView",
  "AddPackageEmployee",
  "AddPackageDescription",
  "AddPackageCustomer",
  "AddPackageDelivery",
  "AllEntryExitRecordsExport",
  "EmployeeVerifiedIdView",
  "GuardVerifiedIdView",
];

async function getExistingPermissionColumns(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserPermissions'`
  );
  const existing = new Set(rows.map((r) => r.COLUMN_NAME));
  return PERMISSION_COLUMNS.filter((c) => existing.has(c));
}

async function upsertFullPermissions(conn, accessId) {
  const columns = await getExistingPermissionColumns(conn);
  if (columns.length === 0) return 0;

  const colList = columns.map((c) => `\`${c}\``).join(", ");
  const values = columns.map(() => "1").join(", ");
  const updates = columns.map((c) => `\`${c}\` = 1`).join(", ");

  await conn.query(
    `INSERT INTO UserPermissions (AccessId, ${colList}) VALUES (?, ${values})
     ON DUPLICATE KEY UPDATE ${updates}`,
    [accessId]
  );
  return columns.length;
}

async function main() {
  loadEnvFile();

  const validationError = validatePassword(PASSWORD);
  if (validationError) throw new Error(validationError);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log(` Connected to MySQL database "${process.env.DB_NAME}"`);

    const passwordHash = await hashPassword(PASSWORD);
    let accessId;
    let action;

    await conn.beginTransaction();
    try {
      const [existing] = await conn.query(
        "SELECT Id, AccessId FROM Users WHERE REPLACE(LOWER(Username), ' ', '') = REPLACE(LOWER(?), ' ', '') LIMIT 1",
        [USERNAME]
      );

      if (existing.length > 0) {
        accessId = existing[0].AccessId;
        await conn.query(
          "UPDATE Users SET PasswordHash = ?, Role = ?, IsActive = 1 WHERE Id = ?",
          [passwordHash, ROLE, existing[0].Id]
        );
        action = "updated (password reset, role set to superAdmin, activated)";
      } else {
        const [dupName] = await conn.query(
          "SELECT Id FROM Users WHERE REPLACE(LOWER(FullName), ' ', '') = REPLACE(LOWER(?), ' ', '') LIMIT 1",
          [FULL_NAME]
        );
        if (dupName.length > 0) {
          throw new Error(`Full Name "${FULL_NAME}" already exists. Pass a different name as the 3rd argument.`);
        }

        accessId = await generateSuperAdminAccessId(conn);
        await conn.query(
          `INSERT INTO Users (AccessId, Username, PasswordHash, FullName, Role, Department, Company, IsActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [accessId, USERNAME, passwordHash, FULL_NAME, ROLE, "Administration", null]
        );
        action = "created";
      }

      const permCount = await upsertFullPermissions(conn, accessId);
      await conn.commit();
      console.log(` SuperAdmin ${action}`);
      console.log(` Granted ${permCount} permissions`);
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    // ---- Verification ----------------------------------------------------
    const [rows] = await conn.query(
      "SELECT Id, AccessId, Username, FullName, Role, IsActive, PasswordHash FROM Users WHERE Username = ? LIMIT 1",
      [USERNAME]
    );
    const user = rows[0];
    if (!user) throw new Error("Verification failed: user not found after insert");

    const passwordOk = await verifyPassword(PASSWORD, user.PasswordHash);

    console.log("\nStored user:");
    console.table([
      {
        Id: user.Id,
        AccessId: user.AccessId,
        Username: user.Username,
        FullName: user.FullName,
        Role: user.Role,
        IsActive: user.IsActive,
      },
    ]);

    console.log(`Role is superAdmin : ${user.Role === ROLE ? " yes" : " no"}`);
    console.log(`Account active     : ${user.IsActive ? " yes" : " no"}`);
    console.log(`Password verifies  : ${passwordOk ? " yes" : " no"}`);

    if (user.Role !== ROLE || !user.IsActive || !passwordOk) {
      process.exitCode = 1;
      console.error("\n Verification FAILED");
    } else {
      console.log(`\n Done. Log in with  username: ${USERNAME}  password: ${PASSWORD}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(" Error:", err.message);
  process.exitCode = 1;
});
