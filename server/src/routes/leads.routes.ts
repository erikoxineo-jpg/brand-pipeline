import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /api/leads?search=&stage=&stages=&opt_out=&sort=&order=&page=1&limit=20
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const search = (req.query.search as string) || "";
    const stage = req.query.stage as string | undefined;
    const stages = req.query.stages as string | undefined;
    const optOut = req.query.opt_out as string | undefined;
    const sort = req.query.sort as string | undefined;
    const order = (req.query.order as string) || "desc";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = { workspace_id: workspaceId };

    if (stages) {
      where.stage = { in: stages.split(",") };
    } else if (stage) {
      where.stage = stage;
    }

    if (optOut === "false") {
      where.opt_out = false;
    } else if (optOut === "true") {
      where.opt_out = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const validSortFields = ["created_at", "name", "days_inactive", "stage"];
    const orderByField = validSortFields.includes(sort || "") ? sort! : "created_at";
    const orderByDir = order === "asc" ? "asc" : "desc";

    const [leads, count] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ data: leads, total: count });
  } catch (err: any) {
    console.error("List leads error:", err.message);
    res.status(500).json({ error: "Erro ao listar leads" });
  }
});

// POST /api/leads
router.post("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { name, phone, email, last_purchase, days_inactive, metadata } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "phone é obrigatório" });
    }

    const lead = await prisma.lead.create({
      data: {
        workspace_id: workspaceId,
        name: name || null,
        phone,
        email: email || null,
        last_purchase: last_purchase || null,
        days_inactive: days_inactive != null ? parseInt(days_inactive) || null : null,
        metadata: metadata || null,
        stage: "imported",
      },
    });

    res.status(201).json(lead);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Lead com este telefone já existe neste workspace" });
    }
    console.error("Create lead error:", err.message);
    res.status(500).json({ error: "Erro ao criar lead" });
  }
});

// DELETE /api/leads/bulk — must be before /:id
router.delete("/bulk", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids é obrigatório e deve ser um array" });
    }

    if (ids.length > 100) {
      return res.status(400).json({ error: "Máximo de 100 leads por vez" });
    }

    const result = await prisma.lead.deleteMany({
      where: {
        id: { in: ids },
        workspace_id: workspaceId,
      },
    });

    res.json({ deleted: result.count });
  } catch (err: any) {
    console.error("Bulk delete leads error:", err.message);
    res.status(500).json({ error: "Erro ao deletar leads" });
  }
});

// DELETE /api/leads/filtered?stage=&search= — must be before /:id
router.delete("/filtered", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const search = (req.query.search as string) || "";
    const stage = req.query.stage as string | undefined;

    const where: Prisma.LeadWhereInput = { workspace_id: workspaceId };

    if (stage) {
      where.stage = stage;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const result = await prisma.lead.deleteMany({ where });

    res.json({ deleted: result.count });
  } catch (err: any) {
    console.error("Filtered delete leads error:", err.message);
    res.status(500).json({ error: "Erro ao deletar leads filtrados" });
  }
});

// GET /api/leads/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    const lead = await prisma.lead.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    res.json(lead);
  } catch (err: any) {
    console.error("Get lead error:", err.message);
    res.status(500).json({ error: "Erro ao buscar lead" });
  }
});

// PATCH /api/leads/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    // Verificar que o lead pertence ao workspace
    const existing = await prisma.lead.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    const { stage, opt_out, name, phone, email, last_purchase, days_inactive, metadata, ai_classification, ai_summary } = req.body;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(stage !== undefined && { stage }),
        ...(opt_out !== undefined && { opt_out }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(last_purchase !== undefined && { last_purchase }),
        ...(days_inactive !== undefined && { days_inactive }),
        ...(metadata !== undefined && { metadata }),
        ...(ai_classification !== undefined && { ai_classification }),
        ...(ai_summary !== undefined && { ai_summary }),
      },
    });

    res.json({ lead });
  } catch (err: any) {
    console.error("Update lead error:", err.message);
    res.status(500).json({ error: "Erro ao atualizar lead" });
  }
});

// DELETE /api/leads/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    const existing = await prisma.lead.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    await prisma.lead.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete lead error:", err.message);
    res.status(500).json({ error: "Erro ao deletar lead" });
  }
});

export default router;
