import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { creators, otpChallenges, sellers, sessions, users, type Db } from "@stealth/db";
import { normalizeIndianPhone, type SessionUser } from "@stealth/shared";
import { AppError } from "./errors";
import type { OtpSender } from "./providers/otp/types";
import { safeEqual } from "./providers/safe-equal";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30_000;
export const OTP_MAX_PER_HOUR = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
// Salting with the challenge id means equal codes never share a hash.
const hashCode = (challengeId: string, code: string) => sha256(`${challengeId}:${code}`);

function parsePhone(raw: string): string {
  const phone = normalizeIndianPhone(raw);
  if (!phone) throw new AppError(400, "Enter a 10-digit Indian mobile number");
  return phone;
}

/**
 * Sends a 6-digit login code. Doesn't reveal whether the number has an account:
 * new numbers get an account when they verify.
 */
export async function requestOtp(db: Db, otp: OtpSender, rawPhone: string): Promise<{ phone: string; code: string }> {
  const phone = parsePhone(rawPhone);
  const now = Date.now();

  const [latest] = await db
    .select({ createdAt: otpChallenges.createdAt })
    .from(otpChallenges)
    .where(eq(otpChallenges.phone, phone))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (latest && now - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - latest.createdAt.getTime())) / 1000);
    throw new AppError(429, `Please wait ${wait}s before requesting another code`);
  }

  const [{ sentLastHour }] = await db
    .select({ sentLastHour: count() })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, new Date(now - 60 * 60_000))));
  if (sentLastHour >= OTP_MAX_PER_HOUR) throw new AppError(429, "Too many codes requested. Try again in an hour.");

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const id = crypto.randomUUID();
  await db.insert(otpChallenges).values({ id, phone, codeHash: hashCode(id, code), expiresAt: new Date(now + OTP_TTL_MS) });
  await otp.send(phone, code);
  return { phone, code };
}

/** Checks a login code. On success, finds or creates the user and starts a session. */
export async function verifyOtp(db: Db, rawPhone: string, code: string): Promise<{ token: string; user: SessionUser }> {
  const phone = parsePhone(rawPhone);

  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (!challenge) throw new AppError(400, "Code expired. Request a new one.");

  // Count the attempt before comparing, atomically, so parallel guesses can't exceed the limit.
  const [counted] = await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(and(eq(otpChallenges.id, challenge.id), lt(otpChallenges.attempts, OTP_MAX_ATTEMPTS)))
    .returning({ attempts: otpChallenges.attempts });
  if (!counted) throw new AppError(429, "Too many wrong attempts. Request a new code.");

  if (!/^\d{6}$/.test(code) || !safeEqual(hashCode(challenge.id, code), challenge.codeHash)) {
    const left = OTP_MAX_ATTEMPTS - counted.attempts;
    throw new AppError(400, left > 0 ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong code. Request a new one.");
  }

  // Consume exactly once, even if the same code is submitted twice at the same moment.
  const [consumed] = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  if (!consumed) throw new AppError(400, "Code already used. Request a new one.");

  await db.insert(users).values({ phone }).onConflictDoNothing({ target: users.phone });
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));

  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });

  const sessionUser = await loadSessionUser(db, user.id);
  if (!sessionUser) throw new Error("user vanished while signing in");
  return { token, user: sessionUser };
}

/** The signed-in user for a session cookie value, or null if it's missing, unknown or expired. */
export async function getSessionUser(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  return session ? loadSessionUser(db, session.userId) : null;
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

async function loadSessionUser(db: Db, userId: string): Promise<SessionUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const [creator] = await db.select({ id: creators.id }).from(creators).where(eq(creators.userId, userId));
  const owned = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.ownerUserId, userId));
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    isAdmin: user.isAdmin,
    creatorId: creator?.id ?? null,
    sellerIds: owned.map((s) => s.id),
  };
}
