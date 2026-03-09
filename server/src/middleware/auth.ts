import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      workspaceId?: string;
      workspaceRole?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
