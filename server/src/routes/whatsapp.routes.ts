import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/whatsapp/config
router.get("/config", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const config = await prisma.whatsappConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    res.json({ config: config || null });
  } catch (err: any) {
    console.error("Get whatsapp config error:", err.message);
    res.status(500).json({ error: "Erro ao buscar configuração do WhatsApp" });
  }
});

// PUT /api/whatsapp/config
router.put("/config", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const {
      provider,
      phone_number_id,
      waba_id,
      access_token,
      verify_token,
      webhook_secret,
      evolution_instance_name,
      evolution_phone,
      evolution_status,
    } = req.body;

    const data = {
      provider: provider || "evolution",
      ...(phone_number_id !== undefined && { phone_number_id }),
      ...(waba_id !== undefined && { waba_id }),
      ...(access_token !== undefined && { access_token }),
      ...(verify_token !== undefined && { verify_token }),
      ...(webhook_secret !== undefined && { webhook_secret }),
      ...(evolution_instance_name !== undefined && { evolution_instance_name }),
      ...(evolution_phone !== undefined && { evolution_phone }),
      ...(evolution_status !== undefined && { evolution_status }),
    };

    const config = await prisma.whatsappConfig.upsert({
      where: { workspace_id: workspaceId },
      create: {
        workspace_id: workspaceId,
        ...data,
      },
      update: data,
    });

    res.json({ config });
  } catch (err: any) {
    console.error("Upsert whatsapp config error:", err.message);
    res.status(500).json({ error: "Erro ao salvar configuração do WhatsApp" });
  }
});

export default router;
