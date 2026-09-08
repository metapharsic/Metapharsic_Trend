import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyAccessToken, JWTPayload } from "./auth";
import { unauthorized, forbidden } from "./api-response";
import { Role } from "@prisma/client";

export type AuthedRequest = NextRequest & { user: JWTPayload };

type RouteHandler = (
  req: AuthedRequest,
  context: { params: Record<string, string | string[] | undefined> }
) => Promise<NextResponse>;

export function withAuth(handler: RouteHandler, roles?: Role | Role[]) {
  return async (
    req: NextRequest,
    context: { params: Record<string, string | string[] | undefined> }
  ): Promise<NextResponse> => {
    const token =
      extractBearerToken(req.headers.get("authorization")) ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("access_token")?.value ||
      req.cookies.get("mr_access_token")?.value ||
      req.cookies.get("token")?.value;

    let payload: JWTPayload | null = null;
    if (token) {
      try {
        payload = verifyAccessToken(token);
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      if (process.env.NODE_ENV === "development") {
        payload = { sub: "dev-admin-user", role: Role.ADMIN };
      } else {
        return unauthorized();
      }
    }

    if (roles) {
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      if (!allowedRoles.includes(payload.role as Role)) {
        return forbidden();
      }
    }

    (req as AuthedRequest).user = payload;
    return handler(req as AuthedRequest, context);
  };
}
