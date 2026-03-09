import express from "express";
import cors from "cors";
import http from "http";
import cron from "node-cron";
import { config } from "./config";
import { setupSocketIO } from "./socket";
import { requireAuth } from "./middleware/auth";
import { requireWorkspace } from "./middleware/workspace";
import { runCampaignEngine } from "./services/campaign-engine";

// Routes
import authRoutes from "./routes/auth.routes";
import leadsRoutes from "./routes/leads.routes";
import importsRoutes from "./routes/imports.routes";
import campaignsRoutes from "./routes/campaigns.routes";
import dispatchesRoutes from "./routes/dispatches.routes";
import pipelineRoutes from "./routes/pipeline.routes";
import messagesRoutes from "./routes/messages.routes";
import workspacesRoutes from "./routes/workspaces.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import evolutionWebhookRoutes from "./routes/webhooks/evolution.routes";
import whatsappWebhookRoutes from "./routes/webhooks/whatsapp.routes";
import asaasWebhookRoutes from "./routes/webhooks/asaas.routes";
import billingRoutes from "./routes/billing.routes";

const app = express();
const server = http.createServer(app);

// Socket.io
setupSocketIO(server);

// Middleware global
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (sem middleware de workspace)
app.use("/api/auth", authRoutes);

// Rotas protegidas com auth + workspace
app.use("/api/leads", requireAuth, requireWorkspace, leadsRoutes);
app.use("/api/imports", requireAuth, requireWorkspace, importsRoutes);
app.use("/api/campaigns", requireAuth, requireWorkspace, campaignsRoutes);
app.use("/api/dispatches", requireAuth, requireWorkspace, dispatchesRoutes);
app.use("/api/pipeline", requireAuth, requireWorkspace, pipelineRoutes);
app.use("/api/messages", requireAuth, requireWorkspace, messagesRoutes);
app.use("/api/dashboard", requireAuth, requireWorkspace, dashboardRoutes);
app.use("/api/whatsapp", requireAuth, requireWorkspace, whatsappRoutes);

// Workspace routes (auth obrigatório, workspace check dentro das rotas)
app.use("/api/workspaces", requireAuth, workspacesRoutes);

// Webhook routes (sem auth — validação interna)
app.use("/api/webhooks/evolution", evolutionWebhookRoutes);
app.use("/api/webhooks/whatsapp", whatsappWebhookRoutes);
app.use("/api/webhooks/asaas", asaasWebhookRoutes);

// Billing routes (auth + workspace obrigatório)
app.use("/api/billing", requireAuth, requireWorkspace, billingRoutes);

// Error handler global
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

server.listen(config.port, () => {
  console.log(`ReConnect API rodando na porta ${config.port} [${config.nodeEnv}]`);

  // Cron: campaign engine a cada 5 minutos
  cron.schedule("*/5 * * * *", async () => {
    console.log("[cron] Executando campaign engine...");
    try {
      await runCampaignEngine();
    } catch (err: any) {
      console.error("[cron] Erro no campaign engine:", err.message);
    }
  });

  console.log("[cron] Campaign engine agendado (a cada 5 min)");
});

export { app, server };
