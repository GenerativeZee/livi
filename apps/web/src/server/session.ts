import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import type { SessionUser } from "@stealth/shared";
import { getSessionUser, SESSION_TTL_MS } from "./auth";
import { getDb } from "./db";
import { AppError } from "./errors";

const SESSION_COOKIE = "session";

/**
 * The signed-in user for this request, looked up once per request.
 * The cookie is SameSite=Lax and every mutating API takes JSON, so other sites can't make
 * signed-in requests on a user's behalf.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  // Session expiry compares against the current time, so this must never run while prerendering.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(await getDb(), token);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AppError(401, "Sign in first");
  return user;
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
