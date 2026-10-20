import "server-only";

/** An expected failure with a message that is safe to show the user. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turns AppErrors into JSON responses; anything else is a bug and stays a 500. */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
