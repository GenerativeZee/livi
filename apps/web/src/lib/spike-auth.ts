import "server-only";
import { timingSafeEqual } from "node:crypto";
import { creatorToken } from "./env";

export const CREATOR_TOKEN_HEADER = "x-creator-token";

/** Throwaway auth for the spikes. Real creator auth (phone OTP + roles) replaces this in Phase 1. */
export function isCreator(request: Request): boolean {
  const given = Buffer.from(request.headers.get(CREATOR_TOKEN_HEADER) ?? "");
  const expected = Buffer.from(creatorToken());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const unauthorized = () => Response.json({ error: "invalid creator token" }, { status: 401 });
