import { z } from "zod";
import type { OtpRequestResponse } from "@stealth/shared";
import { OTP_TTL_MS, requestOtp } from "@/server/auth";
import { getDb } from "@/server/db";
import { showDevOtpCodes } from "@/server/env";
import { errorResponse } from "@/server/errors";
import { getProviders } from "@/server/providers";

const Body = z.object({ phone: z.string().max(32) });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { phone }" }, { status: 400 });

  try {
    const { phone, code } = await requestOtp(await getDb(), getProviders().otp, body.data.phone);
    const response: OtpRequestResponse = {
      phone,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(showDevOtpCodes() && { devCode: code }),
    };
    return Response.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
