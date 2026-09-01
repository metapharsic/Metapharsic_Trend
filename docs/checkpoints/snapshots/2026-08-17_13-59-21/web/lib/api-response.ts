import { NextResponse } from "next/server";

export function ok(data: unknown) {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

export function created(data: unknown) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status }
  );
}

export function badRequest(message: string, details?: unknown) {
  return apiError("BAD_REQUEST", message, 400, details);
}

export function unauthorized(message = "Authentication required") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return apiError("FORBIDDEN", message, 403);
}

export function notFound(message = "Resource not found") {
  return apiError("NOT_FOUND", message, 404);
}

export function conflict(message = "Resource conflict") {
  return apiError("CONFLICT", message, 409);
}
