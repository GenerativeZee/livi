import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, otpChallenges, seed, sessions, type Db } from "@stealth/db";
import { DEMO_ADMIN, DEMO_CREATOR, DEMO_SELLERS, DEMO_SHOPPER } from "@stealth/shared";
import { endSession, getSessionUser, OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, requestOtp, verifyOtp } from "./auth";
import { AppError } from "./errors";
import type { OtpSender } from "./providers/otp/types";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));

/** Records what would have been texted, instead of printing it. */
function capturingOtp() {
  const sent: { phone: string; code: string }[] = [];
  const sender: OtpSender = { name: "fake", send: async (phone, code) => void sent.push({ phone, code }) };
  return { sender, lastCode: () => sent.at(-1)?.code ?? "", sent };
}

const rejectsWith = (status: number) => expect.objectContaining({ constructor: AppError, status });
const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000");

let db: Db;
let otp: ReturnType<typeof capturingOtp>;
beforeEach(async () => {
  db = await createMemoryDb(migrationsFolder);
  await seed(db);
  otp = capturingOtp();
});

/** Lets a test request another code without waiting out the resend cooldown. */
const ageChallenges = (phone: string, ms: number) =>
  db.update(otpChallenges).set({ createdAt: new Date(Date.now() - ms) }).where(eq(otpChallenges.phone, phone));

describe("phone login", () => {
  it("signs an existing user in with their roles", async () => {
    await requestOtp(db, otp.sender, "98000 00002");
    expect(otp.sent[0].phone).toBe(DEMO_CREATOR.phone);

    const { token, user } = await verifyOtp(db, DEMO_CREATOR.phone, otp.lastCode());
    expect(user).toMatchObject({ id: DEMO_CREATOR.userId, creatorId: DEMO_CREATOR.id, isAdmin: false, sellerIds: [] });
    expect(await getSessionUser(db, token)).toEqual(user);
  });

  it("reports seller and admin roles", async () => {
    await requestOtp(db, otp.sender, DEMO_SELLERS[0].phone);
    expect((await verifyOtp(db, DEMO_SELLERS[0].phone, otp.lastCode())).user.sellerIds).toEqual([DEMO_SELLERS[0].id]);

    await requestOtp(db, otp.sender, DEMO_ADMIN.phone);
    expect((await verifyOtp(db, DEMO_ADMIN.phone, otp.lastCode())).user.isAdmin).toBe(true);
  });

  it("creates an account for a new number", async () => {
    await requestOtp(db, otp.sender, "9123456789");
    const { user } = await verifyOtp(db, "+919123456789", otp.lastCode());
    expect(user).toMatchObject({ phone: "+919123456789", creatorId: null, isAdmin: false, sellerIds: [] });
  });

  it("stores only hashes of codes and session tokens", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    const code = otp.lastCode();
    const [challenge] = await db.select().from(otpChallenges);
    expect(challenge.codeHash).not.toContain(code);

    const { token } = await verifyOtp(db, DEMO_SHOPPER.phone, code);
    const [session] = await db.select().from(sessions);
    expect(session.tokenHash).not.toBe(token);
  });

  it("accepts each code only once", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    await verifyOtp(db, DEMO_SHOPPER.phone, otp.lastCode());
    await expect(verifyOtp(db, DEMO_SHOPPER.phone, otp.lastCode())).rejects.toEqual(rejectsWith(400));
  });

  it("locks a code after too many wrong guesses, even if the right one comes next", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    const code = otp.lastCode();
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(verifyOtp(db, DEMO_SHOPPER.phone, wrongCode(code))).rejects.toEqual(rejectsWith(400));
    }
    await expect(verifyOtp(db, DEMO_SHOPPER.phone, code)).rejects.toEqual(rejectsWith(429));
  });

  it("rejects expired codes", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    await db.update(otpChallenges).set({ expiresAt: new Date(Date.now() - 1) });
    await expect(verifyOtp(db, DEMO_SHOPPER.phone, otp.lastCode())).rejects.toEqual(rejectsWith(400));
  });

  it("rate-limits sending codes to one number", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    await expect(requestOtp(db, otp.sender, DEMO_SHOPPER.phone)).rejects.toEqual(rejectsWith(429));

    for (let i = 1; i < OTP_MAX_PER_HOUR; i++) {
      await ageChallenges(DEMO_SHOPPER.phone, 60_000);
      await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    }
    await ageChallenges(DEMO_SHOPPER.phone, 60_000);
    await expect(requestOtp(db, otp.sender, DEMO_SHOPPER.phone)).rejects.toEqual(rejectsWith(429));
  });

  it("rejects numbers that aren't Indian mobiles", async () => {
    await expect(requestOtp(db, otp.sender, "12345")).rejects.toEqual(rejectsWith(400));
    expect(otp.sent).toHaveLength(0);
  });

  it("ends the session on sign-out", async () => {
    await requestOtp(db, otp.sender, DEMO_SHOPPER.phone);
    const { token } = await verifyOtp(db, DEMO_SHOPPER.phone, otp.lastCode());
    await endSession(db, token);
    expect(await getSessionUser(db, token)).toBeNull();
    expect(await getSessionUser(db, "made-up-token")).toBeNull();
  });
});
