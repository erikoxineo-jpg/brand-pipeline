import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, TrendingUp, ShoppingCart, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
