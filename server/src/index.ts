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
import agentRoutes from "./routes/agent.routes";

const app = express();
const server = http.createServer(app);

// Socket.io
setupSocketIO(server);

// Middleware global
app.use(cors());

// ── Webhook routes FIRST (with tolerant body parsing, no auth) ──
// Evolution API sometimes sends JSON with bad escape sequences
const tolerantJsonParser: express.RequestHandler[] = [
  express.raw({ type: "*/*", limit: "10mb" }),
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      const raw = req.body.toString("utf8");
      try {
        req.body = JSON.parse(raw);
      } catch {
        try {
          const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, " ");
          req.body = JSON.parse(cleaned);
        } catch {
          console.error("Webhook JSON parse failed, raw length:", raw.length);
          req.body = {};
        }
      }
    } else if (!req.body || (typeof req.body === "object" && Object.keys(req.body).length === 0)) {
      req.body = {};
    }
    next();
  },
];
app.use("/api/webhooks/evolution", ...tolerantJsonParser, evolutionWebhookRoutes);
app.use("/api/webhooks/whatsapp", express.json({ limit: "10mb" }), whatsappWebhookRoutes);
app.use("/api/webhooks/asaas", express.json({ limit: "10mb" }), asaasWebhookRoutes);

// Standard JSON parser for all other routes
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

// Billing routes (auth + workspace obrigatório)
app.use("/api/billing", requireAuth, requireWorkspace, billingRoutes);

// Agent routes (auth + workspace obrigatório)
app.use("/api/agent", requireAuth, requireWorkspace, agentRoutes);

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
