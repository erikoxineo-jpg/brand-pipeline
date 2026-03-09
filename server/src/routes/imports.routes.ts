import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/imports
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const imports = await prisma.import.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });

    res.json(imports);
  } catch (err: any) {
    console.error("List imports error:", err.message);
    res.status(500).json({ error: "Erro ao listar importações" });
  }
});

// POST /api/imports
router.post("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { leads, filename } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "leads é obrigatório e deve ser um array não vazio" });
    }

    if (!filename) {
      return res.status(400).json({ error: "filename é obrigatório" });
    }

    // Criar import record com status "processing"
    const importRecord = await prisma.import.create({
      data: {
        workspace_id: workspaceId,
        filename,
        total: leads.length,
        status: "processing",
        created_by: userId,
      },
    });

    let newLeads = 0;
    let duplicates = 0;
    let eligible = 0;

    // Upsert leads: conflito em [workspace_id, phone] -> ignora duplicatas
    for (const lead of leads) {
      if (!lead.phone) {
        continue;
      }

      const daysInactive = lead.days_inactive != null ? parseInt(lead.days_inactive) || null : null;
      // Auto-classify: leads inactive >= 90 days are eligible for campaigns
      const stage = daysInactive != null && daysInactive >= 90 ? "eligible" : "imported";
      if (stage === "eligible") eligible++;

      try {
        await prisma.lead.create({
          data: {
            workspace_id: workspaceId,
            name: lead.name || null,
            phone: lead.phone,
            email: lead.email || null,
            last_purchase: lead.last_purchase || null,
            days_inactive: daysInactive,
            metadata: lead.metadata || null,
            stage,
          },
        });
        newLeads++;
      } catch (err: any) {
        // Unique constraint violation (workspace_id + phone) -> duplicata
        if (err.code === "P2002") {
          duplicates++;
        } else {
          throw err;
        }
      }
    }

    // Atualizar import record com resultado final
    const updatedImport = await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        new_leads: newLeads,
        duplicates,
        status: "success",
      },
    });

    res.status(201).json({
      importRecord: updatedImport,
      new_leads: newLeads,
      duplicates,
      total: leads.length,
      eligible,
    });
  } catch (err: any) {
    console.error("Import leads error:", err.message);
    res.status(500).json({ error: "Erro ao importar leads" });
  }
});

export default router;
