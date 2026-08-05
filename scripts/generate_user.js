/* eslint-disable @typescript-eslint/no-require-imports */
const { webcrypto } = require('crypto');
const { subtle } = webcrypto;
const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function base64UrlEncode(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return `pbkdf2$100000$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(derivedBits))}`;
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

async function main() {
  const argv = process.argv.slice(2);
  const username = argv[0] || 'admin';
  const password = argv[1] || 'Admin@1234';
  const fullName = argv[2] || 'Administrator';
  const role = argv[3] || 'superAdmin';
  const department = argv[4] || 'IT';
  const company = argv[5] || 'Company';

  const hash = await hashPassword(password);

  const sql = `INSERT INTO Users (Username, PasswordHash, FullName, Role, Department, Company, IsActive, CreatedAt, UpdatedAt) VALUES (${escapeSql(username)}, ${escapeSql(hash)}, ${escapeSql(fullName)}, ${escapeSql(role)}, ${escapeSql(department)}, ${escapeSql(company)}, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());`;

  console.log(sql);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
