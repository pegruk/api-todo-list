import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";

import { validateToken } from "../utils/jwt.js";

export type AuthenticatedRequest = Request & { userId: string };
type TokenVerifier = (token: string) => string | JwtPayload;

export function createAuthenticateMiddleware(verify: TokenVerifier) {
  return function authenticate(request: Request, response: Response, next: NextFunction) {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) return response.status(401).json({ message: "Unauthorized" });

    try {
      const payload = verify(match[1]);
      if (typeof payload === "string" || typeof payload.sub !== "string" || payload.sub.length === 0) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      (request as AuthenticatedRequest).userId = payload.sub;
      return next();
    } catch {
      return response.status(401).json({ message: "Unauthorized" });
    }
  };
}

export const authenticate = createAuthenticateMiddleware(validateToken);
