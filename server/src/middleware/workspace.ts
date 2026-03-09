import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export async function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  const wsId = req.headers["x-workspace-id"] as string;
  if (!wsId) {
    return res.status(400).json({ error: "Header x-workspace-id obrigatório" });
  }

  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: wsId, user_id: req.userId! } },
    });

    if (!member) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    req.workspaceId = wsId;
    req.workspaceRole = member.role;
    next();
  } catch {
    return res.status(500).json({ error: "Erro ao verificar workspace" });
  }
}
