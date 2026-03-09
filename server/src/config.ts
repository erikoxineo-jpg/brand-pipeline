export const config = {
  port: parseInt(process.env.PORT || "3001"),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  evolutionApiUrl: process.env.EVOLUTION_API_URL || "http://evolution:8080",
  evolutionApiKey: process.env.EVOLUTION_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  asaasApiKey: process.env.ASAAS_API_KEY || "",
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || "",
  publicUrl: process.env.PUBLIC_URL || "https://reconnect.oxineo.com.br",
  nodeEnv: process.env.NODE_ENV || "development",
};

export const planLimits: Record<string, { maxLeads: number; maxMessages: number; maxUsers: number }> = {
  free: { maxLeads: 50, maxMessages: 100, maxUsers: 1 },
  starter: { maxLeads: 500, maxMessages: 1000, maxUsers: 1 },
  professional: { maxLeads: 2000, maxMessages: 5000, maxUsers: 3 },
  business: { maxLeads: 10000, maxMessages: 20000, maxUsers: 10 },
};
