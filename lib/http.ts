import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import type { ErrorResponse } from "@/lib/types";

function normalizeValidationDetails(error: ZodError) {
  return error.flatten().fieldErrors;
}

export function errorResponse(
  status: number,
  error: string,
  details?: ErrorResponse["details"],
) {
  return NextResponse.json<ErrorResponse>(
    {
      success: false,
      error,
      ...(details ? { details } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function jsonResponse<T>(payload: T, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(400, "Invalid JSON body."),
    };
  }

  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(
        400,
        "Request validation failed.",
        normalizeValidationDetails(parsed.error),
      ),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(
        400,
        "Request validation failed.",
        normalizeValidationDetails(parsed.error),
      ),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}
