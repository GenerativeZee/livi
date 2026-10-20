import { endSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { clearSessionCookie, sessionToken } from "@/server/session";

export async function POST() {
  const token = await sessionToken();
  if (token) await endSession(await getDb(), token);
  await clearSessionCookie();
  return Response.json({ ok: true });
}
