export type AuthRole = "Employee" | "admin" | "guard" | "superAdmin";

export type AuthSession = {
  sub: string;
  sessionId?: number;
  username: string;
  role: AuthRole;
  fullName: string;
  exp: number;
  iat: number;
};

const TOKEN_COOKIE_NAME = "guard_auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev-guard-secret-change-me";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlEncode(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }

  return result === 0;
}

function getWebCrypto() {
  const cryptoObject = globalThis.crypto;

  if (!cryptoObject?.subtle) {
    throw new Error("Web Crypto API is not available in this runtime");
  }

  return cryptoObject;
}

function getJsonWebTokenParts(token: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  return parts;
}

export function getAuthCookieName() {
  return TOKEN_COOKIE_NAME;
}

export function getRoleLandingPath(role: AuthRole) {
  if (role === "admin" || role === "superAdmin") {
    return "/Admin/AllUsers";
  }

  if (role === "Employee") {
    return "/pages/IncomingPackage";
  }

  return "/pages/IncomingPackage";
}

export function normalizeRole(role: string | null | undefined): AuthRole {
  const normalized = role?.trim();

  if (!normalized) {
    return "guard";
  }

  const lower = normalized.toLowerCase();

  if (lower === "employee" || lower === "user") {
    return "Employee";
  }

  if (lower === "admin") {
    return "admin";
  }

  if (lower === "superadmin" || lower === "supervisor") {
    return "superAdmin";
  }

  if (lower === "guard") {
    return "guard";
  }

  throw new Error("Invalid role");
}

export async function hashPassword(password: string) {
  const cryptoObject = getWebCrypto();
  const salt = cryptoObject.getRandomValues(new Uint8Array(16));
  const keyMaterial = await cryptoObject.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await cryptoObject.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return `pbkdf2$100000$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split("$");

  if (algorithm !== "pbkdf2" || !iterationsText || !saltText || !hashText) {
    return false;
  }

  const iterations = Number(iterationsText);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const cryptoObject = getWebCrypto();
  const keyMaterial = await cryptoObject.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await cryptoObject.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64UrlDecode(saltText),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return timingSafeEqual(base64UrlDecode(hashText), new Uint8Array(derivedBits));
}

async function signJwt(payload: Record<string, unknown>) {
  const cryptoObject = getWebCrypto();
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = `${headerPart}.${payloadPart}`;
  const key = await cryptoObject.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await cryptoObject.subtle.sign("HMAC", key, encoder.encode(data));

  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyJwt(token: string) {
  const cryptoObject = getWebCrypto();
  const [headerPart, payloadPart, signaturePart] = getJsonWebTokenParts(token);
  const data = `${headerPart}.${payloadPart}`;
  const key = await cryptoObject.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = base64UrlDecode(signaturePart);
  const isValid = await cryptoObject.subtle.verify("HMAC", key, signature, encoder.encode(data));

  if (!isValid) {
    return null;
  }

  const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadPart))) as AuthSession;

  if (!payload.exp || Date.now() >= payload.exp * 1000) {
    return null;
  }

  return payload;
}

export async function createAuthToken(user: {
  id: number;
  sessionId?: number;
  username: string;
  role: AuthRole;
  fullName: string;
  expiresInSeconds?: number;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresInSeconds = user.expiresInSeconds ?? 60 * 60 * 8;

  return signJwt({
    sub: String(user.id),
    sessionId: user.sessionId,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  });
}

export async function verifyAuthToken(token: string) {
  return verifyJwt(token);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return {
      valid: false,
      message: "Password must be at least 6 characters long.",
    };
  }

  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);
  if (!hasSpecialChar) {
    return {
      valid: false,
      message: "Password must contain at least one special character (e.g. @, #, $, !, %, &).",
    };
  }

  return { valid: true };
}

// in gate control page , add reason coloum to Employee exit(Mandatory) and vehicle came(optional) .they should store seprate coloum in database and show in gate record details page.  other is add admin to control OVERDUE_HOURS. add that page in admin  