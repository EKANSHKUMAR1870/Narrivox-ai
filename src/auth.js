import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashPassword(password, salt = randomUUID()) {
  const derivedKey = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) {
    return false;
  }

  const derivedKey = scryptSync(String(password), salt, 64);
  const expectedKey = Buffer.from(key, "hex");

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}

export function createSession(userId) {
  return {
    token: randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
}

export function validateSession(sessions, token) {
  const now = Date.now();
  const activeSessions = Array.isArray(sessions)
    ? sessions.filter((session) => Date.parse(session.expiresAt) > now)
    : [];

  const session = activeSessions.find((entry) => entry.token === token) || null;

  return {
    session,
    activeSessions
  };
}
