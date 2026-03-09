import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/pipeline/leads
router.get("/leads", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const leads = await prisma.lead.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        name: true,
        phone: true,
        stage: true,
        opt_out: true,
        ai_classification: true,
        ai_summary: true,
        days_inactive: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ leads });
  } catch (err: any) {
    console.error("Pipeline leads error:", err.message);
    res.status(500).json({ error: "Erro ao listar leads do pipeline" });
  }
});

export default router;
