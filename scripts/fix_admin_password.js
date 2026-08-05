/**
 * Updates admin PasswordHash to PBKDF2 format (required by lib/auth.ts login).
 * Usage: node scripts/fix_admin_password.js [password] [username]
 * Default: Admin@1234 / admin
 */
const mysql = require("mysql2/promise");
const { webcrypto } = require("crypto");

const encoder = new TextEncoder();
const password = process.argv[2] || "Admin@1234";
const username = process.argv[3] || "admin";

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64UrlEncode(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashPassword(pwd) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(pwd),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `pbkdf2$100000$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(derivedBits))}`;
}

async function main() {
  const hash = await hashPassword(password);
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Akila@1234",
    database: process.env.DB_NAME || "GuardSystemDB",
  });

  const [result] = await pool.query(
    "UPDATE Users SET PasswordHash = ?, UpdatedAt = NOW(6) WHERE Username = ?",
    [hash, username]
  );

  await pool.end();

  if (result.affectedRows === 0) {
    console.error(`No user found with Username = "${username}"`);
    process.exit(1);
  }

  console.log(`✅ Updated PasswordHash for "${username}" (PBKDF2 format)`);
  console.log(`   Login with password: ${password}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
