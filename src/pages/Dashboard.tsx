import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, TrendingUp, ShoppingCart, ArrowUpRight, CheckCircle2, Circle, Wifi, Upload, Megaphone, Send, X, Bot, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 70%, 50%)",
  "hsl(340, 80%, 55%)",
];

const STAGE_LABELS: Record<string, string> = {
  imported: "Importados",
  eligible: "Elegíveis",
  ready: "Pronto",
  contacted: "Contactados",
  replied: "Responderam",
  reactivated: "Reativados",
  optout: "Opt-out",
};

const CHECKLIST_DISMISSED_KEY = "reconnect_onboarding_dismissed";

function GettingStartedChecklist({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(CHECKLIST_DISMISSED_KEY) === "true"
  );

  const { data: waConfig } = useQuery({
    queryKey: ["checklist-wa", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("evolution_status, access_token")
        .eq("workspace_id", workspaceId)
        .single();
      return data;
    },
    enabled: !dismissed,
  });

  const { data: leadCount = 0 } = useQuery({
    queryKey: ["checklist-leads", workspaceId],
    queryFn: async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      return count || 0;
    },
    enabled: !dismissed,
  });

  const { data: campaignCount = 0 } = useQuery({
    queryKey: ["checklist-campaigns", workspaceId],
    queryFn: async () => {
      const { count } = await supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      return count || 0;
    },
    enabled: !dismissed,
  });

  const { data: dispatchSentCount = 0 } = useQuery({
    queryKey: ["checklist-dispatches", workspaceId],
    queryFn: async () => {
      const { count } = await supabase
        .from("dispatches")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .neq("status", "pending");
      return count || 0;
    },
    enabled: !dismissed,
  });

  const steps = [
    { label: "Conectar WhatsApp", done: waConfig?.evolution_status === "connected" || !!waConfig?.access_token, href: "/settings", icon: Wifi },
    { label: "Importar Leads", done: leadCount > 0, href: "/imports", icon: Upload },
    { label: "Criar Campanha", done: campaignCount > 0, href: "/campaigns", icon: Megaphone },
    { label: "Enviar Primeiro Disparo", done: dispatchSentCount > 0, href: "/dispatches", icon: Send },
  ];

  const allDone = steps.every((s) => s.done);
  const completedCount = steps.filter((s) => s.done).length;

  if (dismissed || allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Primeiros Passos</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{completedCount} de {steps.length} concluídos</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem(CHECKLIST_DISMISSED_KEY, "true");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                step.done ? "bg-background/50 border-border" : "bg-background border-primary/20 cursor-pointer hover:border-primary/40"
              }`}
              onClick={() => !step.done && navigate(step.href)}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                  {step.label}
                </span>
              </div>
              {!step.done && (
                <Button variant="ghost" size="sm" className="shrink-0 text-xs h-7 px-2">
                  Configurar
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const Dashboard = () => {
  const { currentWorkspace } = useAuth();
  const workspaceId = currentWorkspace?.id;

  // Lead counts by stage
  const { data: leadStages = [] } = useQuery({
    queryKey: ["dashboard-leads", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("stage")
        .eq("workspace_id", workspaceId);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const lead of data || []) {
        counts[lead.stage] = (counts[lead.stage] || 0) + 1;
      }

      return Object.entries(STAGE_LABELS).map(([key, label]) => ({
        name: label,
        value: counts[key] || 0,
        key,
      }));
    },
    enabled: !!workspaceId,
  });

  // Dispatch stats
  const { data: dispatchStats } = useQuery({
    queryKey: ["dashboard-dispatches", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { today: 0, total: 0, replied: 0, sent: 0 };

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("dispatches")
        .select("status, sent_at")
        .eq("workspace_id", workspaceId);
      if (error) throw error;

      let today = 0;
      let sent = 0;
      let replied = 0;

      for (const d of data || []) {
        if (["sent", "delivered", "read", "replied"].includes(d.status)) sent++;
        if (d.status === "replied") replied++;
        if (d.sent_at && new Date(d.sent_at) >= todayStart) today++;
      }

      return { today, total: data?.length || 0, replied, sent };
    },
    enabled: !!workspaceId,
  });

  // Weekly dispatches (last 7 days)
  const { data: weeklyData = [] } = useQuery({
    queryKey: ["dashboard-weekly", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }

      const startDate = days[0] + "T00:00:00Z";
      const { data, error } = await supabase
        .from("dispatches")
        .select("status, sent_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", startDate);
      if (error) throw error;

      const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      return days.map((day) => {
        const dayDispatches = (data || []).filter(
          (d) => d.sent_at && d.sent_at.slice(0, 10) === day
        );
        const date = new Date(day + "T12:00:00");
        return {
          day: dayLabels[date.getDay()],
          disparos: dayDispatches.length,
          respostas: dayDispatches.filter((d) => d.status === "replied").length,
        };
      });
    },
    enabled: !!workspaceId,
  });

  // Operator performance
  const { data: operatorData = [] } = useQuery({
    queryKey: ["dashboard-operators", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      // Get all workspace members
      const { data: members, error: membersErr } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      if (membersErr) throw membersErr;

      const userIds = (members || []).map((m) => m.user_id);
      if (!userIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) {
        profileMap[p.user_id] = p.display_name || "Sem nome";
      }

      // Get imports (as a proxy for who created dispatches)
      const { data: imports } = await supabase
        .from("imports")
        .select("created_by, new_leads")
        .eq("workspace_id", workspaceId);

      const opStats: Record<string, { name: string; leads: number }> = {};
      for (const imp of imports || []) {
        if (!imp.created_by) continue;
        if (!opStats[imp.created_by]) {
          opStats[imp.created_by] = {
            name: profileMap[imp.created_by] || "Usuário",
            leads: 0,
          };
        }
        opStats[imp.created_by].leads += imp.new_leads || 0;
      }

      return Object.values(opStats).sort((a, b) => b.leads - a.leads);
    },
    enabled: !!workspaceId,
  });

  // Agent stats (automation)
  const { data: agentStats } = useQuery({
    queryKey: ["dashboard-agent", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { activeCampaigns: 0, sent24h: 0, classified24h: 0, autoResponded24h: 0 };

      const yesterday = new Date(Date.now() - 86400000).toISOString();

      // Active campaigns with auto_dispatch
      const { count: activeCampaigns } = await supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .eq("auto_dispatch", true);

      // Dispatches sent in last 24h
      const { count: sent24h } = await supabase
        .from("dispatches")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .neq("status", "pending")
        .gte("sent_at", yesterday);

      // Dispatches with AI classification in last 24h
      const { count: classified24h } = await supabase
        .from("dispatches")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .not("ai_classification", "is", null)
        .gte("created_at", yesterday);

      // Auto-responded (outbound messages in last 24h that have dispatch_id)
      const { count: autoResponded24h } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("direction", "outbound")
        .gte("created_at", yesterday);

      return {
        activeCampaigns: activeCampaigns || 0,
        sent24h: sent24h || 0,
        classified24h: classified24h || 0,
        autoResponded24h: autoResponded24h || 0,
      };
    },
    enabled: !!workspaceId,
  });

  const totalLeads = leadStages.reduce((sum, s) => sum + s.value, 0);
  const reactivated = leadStages.find((s) => s.key === "reactivated")?.value || 0;
  const responseRate = dispatchStats?.sent
    ? ((dispatchStats.replied / dispatchStats.sent) * 100).toFixed(1)
    : "0";

  const kpis = [
    { title: "Leads Ativos", value: totalLeads.toLocaleString(), icon: Users },
    { title: "Disparos Hoje", value: String(dispatchStats?.today || 0), icon: MessageSquare },
    { title: "Taxa Resposta", value: `${responseRate}%`, icon: TrendingUp },
    { title: "Reativações", value: String(reactivated), icon: ShoppingCart },
  ];

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Nenhum workspace disponível</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não possui um workspace ativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de {currentWorkspace.name}
        </p>
      </div>

      {/* Getting Started Checklist */}
      {workspaceId && <GettingStartedChecklist workspaceId={workspaceId} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-semibold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Panel */}
      {agentStats && (
        <Card className={agentStats.activeCampaigns > 0 ? "border-primary/20 bg-primary/5" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Agente Autônomo</h3>
                  <p className="text-[10px] text-muted-foreground">Motor roda a cada 5 min</p>
                </div>
              </div>
              <Badge variant="secondary" className={agentStats.activeCampaigns > 0 ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}>
                <Zap className="h-3 w-3 mr-1" />
                {agentStats.activeCampaigns > 0 ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold text-foreground">{agentStats.sent24h}</p>
                <p className="text-[10px] text-muted-foreground">Enviados (24h)</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{agentStats.classified24h}</p>
                <p className="text-[10px] text-muted-foreground">IA Classificou</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{agentStats.autoResponded24h}</p>
                <p className="text-[10px] text-muted-foreground">Respostas Auto</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leadStages.filter((s) => s.key !== "optout").map((item, i) => {
                const maxVal = Math.max(...leadStages.map((s) => s.value), 1);
                const pct = (item.value / maxVal) * 100;
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Disparos da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="disparos" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="respostas" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Operator Performance */}
        {operatorData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Performance por Operador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operatorData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="leads" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} name="Leads importados" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
