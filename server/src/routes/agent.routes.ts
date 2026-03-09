import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/agent/config — Buscar config do agente
router.get("/config", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const config = await prisma.agentConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    res.json(config || { enabled: false });
  } catch (err: any) {
    console.error("Agent config fetch error:", err.message);
    res.status(500).json({ error: "Erro ao buscar configuração do agente" });
  }
});

// PUT /api/agent/config — Criar/atualizar config
router.put("/config", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { enabled, brand_name, brand_tone, business_context, escalation_rules, max_turns, system_prompt } = req.body;

    const config = await prisma.agentConfig.upsert({
      where: { workspace_id: workspaceId },
      update: {
        enabled: enabled ?? false,
        brand_name: brand_name ?? null,
        brand_tone: brand_tone ?? "amigável e informal",
        business_context: business_context ?? null,
        escalation_rules: escalation_rules ?? null,
        max_turns: max_turns ?? 10,
        system_prompt: system_prompt ?? null,
      },
      create: {
        workspace_id: workspaceId,
        enabled: enabled ?? false,
        brand_name: brand_name ?? null,
        brand_tone: brand_tone ?? "amigável e informal",
        business_context: business_context ?? null,
        escalation_rules: escalation_rules ?? null,
        max_turns: max_turns ?? 10,
        system_prompt: system_prompt ?? null,
      },
    });

    res.json(config);
  } catch (err: any) {
    console.error("Agent config update error:", err.message);
    res.status(500).json({ error: "Erro ao salvar configuração do agente" });
  }
});

// GET /api/agent/escalated — Listar leads escalados
router.get("/escalated", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const leads = await prisma.lead.findMany({
      where: {
        workspace_id: workspaceId,
        agent_escalated: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        stage: true,
        agent_escalated_at: true,
        agent_escalation_reason: true,
        ai_classification: true,
        ai_summary: true,
      },
      orderBy: { agent_escalated_at: "desc" },
    });

    res.json(leads);
  } catch (err: any) {
    console.error("Agent escalated fetch error:", err.message);
    res.status(500).json({ error: "Erro ao listar escalações" });
  }
});

// POST /api/agent/resolve/:leadId — Resolver escalação
router.post("/resolve/:leadId", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const leadId = req.params.leadId as string;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspace_id: workspaceId },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        agent_escalated: false,
        agent_escalated_at: null,
        agent_escalation_reason: null,
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Agent resolve error:", err.message);
    res.status(500).json({ error: "Erro ao resolver escalação" });
  }
});

export default router;
