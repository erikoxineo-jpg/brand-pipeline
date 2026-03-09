import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// PATCH /api/workspaces/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;
    const { name } = req.body;

    // Verificar membership
    const member = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!member) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: name.trim() },
    });

    res.json({ workspace });
  } catch (err: any) {
    console.error("Update workspace error:", err.message);
    res.status(500).json({ error: "Erro ao atualizar workspace" });
  }
});

// GET /api/workspaces/:id/members
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;

    // Verificar membership
    const selfMember = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!selfMember) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    // Flatten para facilitar consumo no frontend
    const result = members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      email: m.user.email,
      display_name: m.user.profile?.display_name || null,
      avatar_url: m.user.profile?.avatar_url || null,
    }));

    res.json(result);
  } catch (err: any) {
    console.error("List members error:", err.message);
    res.status(500).json({ error: "Erro ao listar membros" });
  }
});

// POST /api/workspaces/:id/members
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;
    const { email, role } = req.body;

    // Verificar membership do solicitante
    const selfMember = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!selfMember) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email é obrigatório" });
    }

    const validRoles = ["owner", "admin", "member"];
    const memberRole = validRoles.includes(role) ? role : "member";

    // Buscar user pelo email
    const targetUser = await prisma.user.findUnique({ where: { email } });

    if (!targetUser) {
      return res.status(404).json({ error: "Usuário não encontrado com este email" });
    }

    // Verificar se já é membro
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUser.id } },
    });

    if (existing) {
      return res.status(409).json({ error: "Usuário já é membro deste workspace" });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: targetUser.id,
        role: memberRole,
      },
    });

    res.status(201).json({ member });
  } catch (err: any) {
    console.error("Add member error:", err.message);
    res.status(500).json({ error: "Erro ao adicionar membro" });
  }
});

// PATCH /api/workspaces/:id/members/:memberId
router.patch("/:id/members/:memberId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;
    const memberId = req.params.memberId as string;
    const { role } = req.body;

    // Verificar membership do solicitante
    const selfMember = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!selfMember) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    const validRoles = ["owner", "admin", "member"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: "role deve ser 'owner', 'admin' ou 'member'" });
    }

    // Verificar que o membro alvo existe neste workspace
    const targetMember = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspace_id: workspaceId },
    });

    if (!targetMember) {
      return res.status(404).json({ error: "Membro não encontrado" });
    }

    const member = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
    });

    res.json({ member });
  } catch (err: any) {
    console.error("Update member error:", err.message);
    res.status(500).json({ error: "Erro ao atualizar membro" });
  }
});

// DELETE /api/workspaces/:id/members/:memberId
router.delete("/:id/members/:memberId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;
    const memberId = req.params.memberId as string;

    // Verificar membership do solicitante
    const selfMember = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!selfMember) {
      return res.status(403).json({ error: "Sem acesso a este workspace" });
    }

    // Verificar que o membro alvo existe neste workspace
    const targetMember = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspace_id: workspaceId },
    });

    if (!targetMember) {
      return res.status(404).json({ error: "Membro não encontrado" });
    }

    // Não pode remover o último owner
    if (targetMember.role === "owner") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspace_id: workspaceId, role: "owner" },
      });

      if (ownerCount <= 1) {
        return res.status(400).json({ error: "Não é possível remover o último owner do workspace" });
      }
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Remove member error:", err.message);
    res.status(500).json({ error: "Erro ao remover membro" });
  }
});

export default router;
