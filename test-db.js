const mysql = require("mysql2/promise");
const { webcrypto } = require("crypto");

const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64UrlEncode(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

async function verifyPassword(password, storedHash) {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split("$");

  if (algorithm !== "pbkdf2" || !iterationsText || !saltText || !hashText) {
    return false;
  }

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = base64UrlDecode(saltText);
  const expected = base64UrlDecode(hashText);

  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );

  const actual = new Uint8Array(derivedBits);
  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

async function test() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "Akila@1234",
      database: process.env.DB_NAME || "GuardSystemDB",
    });

    console.log("✅ Connected to MySQL successfully!\n");

    const [users] = await conn.query(
      "SELECT Id, AccessId, Username, Role, IsActive, PasswordHash FROM Users"
    );

    console.log("Users in table:");
    console.table(
      users.map(({ PasswordHash, ...u }) => ({
        ...u,
        hashPrefix: PasswordHash ? String(PasswordHash).slice(0, 20) + "..." : null,
      }))
    );

    const testPasswords = process.argv.slice(2).length
      ? process.argv.slice(2)
      : ["Admin@123", "Admin@1234"];

    for (const user of users) {
      const hash = user.PasswordHash;
      if (!hash) {
        console.log(`User "${user.Username}" — no PasswordHash stored`);
        continue;
      }

      if (!String(hash).startsWith("pbkdf2$")) {
        console.log(
          `User "${user.Username}" — hash is not PBKDF2 format (app expects pbkdf2$...). Re-run: node scripts/generate_user.js`
        );
        continue;
      }

      for (const password of testPasswords) {
        const match = await verifyPassword(password, hash);
        console.log(`User "${user.Username}" — password "${password}" matches: ${match}`);
      }
    }
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

test();
