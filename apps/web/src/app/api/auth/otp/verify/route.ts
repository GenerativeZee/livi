import { z } from "zod";
import { verifyOtp } from "@/server/auth";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { setSessionCookie } from "@/server/session";

const Body = z.object({ phone: z.string().max(32), code: z.string().max(12) });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { phone, code }" }, { status: 400 });

  try {
    const { token, user } = await verifyOtp(await getDb(), body.data.phone, body.data.code.trim());
    await setSessionCookie(token);
    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
