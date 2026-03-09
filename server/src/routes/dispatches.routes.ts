import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { emitToWorkspace } from "../socket";

const router = Router();

// GET /api/dispatches?status=&campaign=&search=
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const status = req.query.status as string | undefined;
    const campaignId = req.query.campaign as string | undefined;
    const leadId = req.query.lead_id as string | undefined;
    const search = (req.query.search as string) || "";

    const where: Prisma.DispatchWhereInput = { workspace_id: workspaceId };

    if (status) {
      where.status = status;
    }

    if (campaignId) {
      where.campaign_id = campaignId;
    }

    if (leadId) {
      where.lead_id = leadId;
    }

    if (search) {
      where.lead = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        lead: { select: { name: true, phone: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    // Map Prisma relation names (singular) to frontend names (plural, Supabase convention)
    const mapped = dispatches.map(({ lead, campaign, ...rest }) => ({
      ...rest,
      leads: lead,
      campaigns: campaign,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error("List dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao listar envios" });
  }
});

// GET /api/dispatches/pending-reviews
router.get("/pending-reviews", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const dispatches = await prisma.dispatch.findMany({
      where: {
        workspace_id: workspaceId,
        ai_response_status: "pending_review",
      },
      include: {
        lead: { select: { name: true, phone: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const mapped = dispatches.map(({ lead, campaign, ...rest }) => ({
      ...rest,
      leads: lead,
      campaigns: campaign,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error("Pending reviews error:", err.message);
    res.status(500).json({ error: "Erro ao listar revisões pendentes" });
  }
});

// POST /api/dispatches
router.post("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { lead_ids, campaign_id } = req.body;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: "lead_ids é obrigatório e deve ser um array não vazio" });
    }

    if (!campaign_id) {
      return res.status(400).json({ error: "campaign_id é obrigatório" });
    }

    // Verificar que a campanha pertence ao workspace
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaign_id, workspace_id: workspaceId },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada" });
    }

    // Verificar que os leads pertencem ao workspace
    const validLeads = await prisma.lead.findMany({
      where: { id: { in: lead_ids }, workspace_id: workspaceId },
      select: { id: true },
    });

    const validIds = validLeads.map((l) => l.id);

    if (validIds.length === 0) {
      return res.status(400).json({ error: "Nenhum lead válido encontrado" });
    }

    // Criar dispatches em batch
    const result = await prisma.dispatch.createMany({
      data: validIds.map((leadId) => ({
        workspace_id: workspaceId,
        lead_id: leadId,
        campaign_id,
        status: "pending",
      })),
    });

    res.status(201).json({ count: result.count });
  } catch (err: any) {
    console.error("Create dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao criar envios" });
  }
});

// POST /api/dispatches/send
router.post("/send", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { dispatch_ids } = req.body;

    if (!Array.isArray(dispatch_ids) || dispatch_ids.length === 0) {
      return res.status(400).json({ error: "dispatch_ids é obrigatório e deve ser um array não vazio" });
    }

    // Fetch dispatches with lead and campaign data
    const dispatches = await prisma.dispatch.findMany({
      where: {
        id: { in: dispatch_ids },
        workspace_id: workspaceId,
        status: "pending",
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, stage: true, days_inactive: true } },
        campaign: { select: { name: true, message_template: true, followup_enabled: true, followup_messages: true } },
      },
    });

    // Get workspace name for template
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const brandName = workspace?.name || "nossa marca";

    const results: { id: string; status: string; error?: string }[] = [];

    for (const dispatch of dispatches) {
      try {
        const lead = dispatch.lead;
        if (!lead?.phone) {
          results.push({ id: dispatch.id, status: "failed", error: "Lead sem telefone" });
          continue;
        }

        // Build message from template
        let message = dispatch.campaign?.message_template || "Olá, sentimos sua falta!";
        message = message.replace(/\{\{nome\}\}/g, lead.name || "");
        message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
        message = message.replace(/\{\{marca\}\}/g, brandName);

        const result = await sendWhatsAppMessage(workspaceId, lead.phone, message, dispatch.id);

        if (result.messageId) {
          await prisma.dispatch.update({
            where: { id: dispatch.id },
            data: {
              status: "sent",
              sent_at: new Date(),
              whatsapp_message_id: result.messageId,
            },
          });

          // Schedule follow-up if enabled
          const followupMessages = (dispatch.campaign?.followup_messages as any[]) || [];
          if (dispatch.campaign?.followup_enabled && followupMessages.length > 0) {
            const nextFollowup = followupMessages[0];
            const delayDays = nextFollowup?.delay_days || 3;
            await prisma.dispatch.update({
              where: { id: dispatch.id },
              data: {
                next_followup_at: new Date(Date.now() + delayDays * 86400000),
                followup_index: 0,
              },
            });
          }

          // Update lead stage to contacted
          if (["ready", "imported", "eligible"].includes(lead.stage)) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { stage: "contacted" },
            });
          }

          emitToWorkspace(workspaceId, "dispatch:updated", { id: dispatch.id, status: "sent" });
          results.push({ id: dispatch.id, status: "sent" });
        } else {
          await prisma.dispatch.update({
            where: { id: dispatch.id },
            data: { status: "failed", error_message: result.error || "Erro desconhecido" },
          });
          emitToWorkspace(workspaceId, "dispatch:updated", { id: dispatch.id, status: "failed" });
          results.push({ id: dispatch.id, status: "failed", error: result.error });
        }
      } catch (sendErr: any) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { status: "failed", error_message: sendErr.message },
        });
        results.push({ id: dispatch.id, status: "failed", error: sendErr.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    console.error("Send dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao enviar mensagens" });
  }
});

// POST /api/dispatches/review
router.post("/review", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { dispatch_id, action, response_text } = req.body;

    if (!dispatch_id) {
      return res.status(400).json({ error: "dispatch_id é obrigatório" });
    }

    if (!["approve", "edit", "reject"].includes(action)) {
      return res.status(400).json({ error: "action deve ser 'approve', 'edit' ou 'reject'" });
    }

    // Verificar que o dispatch pertence ao workspace
    const existing = await prisma.dispatch.findFirst({
      where: { id: dispatch_id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Envio não encontrado" });
    }

    const statusMap: Record<string, string> = {
      approve: "approved",
      edit: "edited",
      reject: "rejected",
    };

    await prisma.dispatch.update({
      where: { id: dispatch_id },
      data: {
        ai_response_status: statusMap[action],
        ai_reviewed_at: new Date(),
        ai_reviewed_by: userId,
        ...(response_text !== undefined && { ai_suggested_response: response_text }),
      },
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Review dispatch error:", err.message);
    res.status(500).json({ error: "Erro ao revisar resposta" });
  }
});

// PATCH /api/dispatches/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    const existing = await prisma.dispatch.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Dispatch não encontrado" });
    }

    const { status, error_message } = req.body;

    const dispatch = await prisma.dispatch.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(error_message !== undefined && { error_message }),
      },
    });

    emitToWorkspace(workspaceId, "dispatch:updated", { id: dispatch.id, status: dispatch.status });
    res.json({ dispatch });
  } catch (err: any) {
    console.error("Update dispatch error:", err.message);
    res.status(500).json({ error: "Erro ao atualizar dispatch" });
  }
});

export default router;
