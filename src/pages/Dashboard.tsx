import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, TrendingUp, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

const kpis = [
  { title: "Leads Ativos", value: "4.328", change: "+12%", up: true, icon: Users },
  { title: "Disparos Hoje", value: "287", change: "+8%", up: true, icon: MessageSquare },
  { title: "Taxa Resposta", value: "34.2%", change: "+2.1%", up: true, icon: TrendingUp },
  { title: "Reativações", value: "89", change: "-3%", up: false, icon: ShoppingCart },
];

const funnelData = [
  { name: "Importados", value: 4328 },
  { name: "Elegíveis", value: 2150 },
  { name: "Contactados", value: 1200 },
  { name: "Responderam", value: 410 },
  { name: "Reativados", value: 89 },
];

const reasonsData = [
  { name: "Preço alto", value: 35 },
  { name: "Esqueceu", value: 28 },
  { name: "Concorrência", value: 18 },
  { name: "Insatisfação", value: 12 },
  { name: "Outros", value: 7 },
];

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 55%)",
  "hsl(0, 84%, 60%)",
];

const operatorData = [
  { name: "Ana", disparos: 120, respostas: 45, reativacoes: 18 },
  { name: "Carlos", disparos: 98, respostas: 38, reativacoes: 12 },
  { name: "Maria", disparos: 85, respostas: 32, reativacoes: 15 },
  { name: "João", disparos: 72, respostas: 25, reativacoes: 8 },
];

const weeklyData = [
  { day: "Seg", disparos: 45, respostas: 18 },
  { day: "Ter", disparos: 52, respostas: 22 },
  { day: "Qua", disparos: 38, respostas: 15 },
  { day: "Qui", disparos: 65, respostas: 28 },
  { day: "Sex", disparos: 48, respostas: 20 },
  { day: "Sáb", disparos: 30, respostas: 12 },
  { day: "Dom", disparos: 9, respostas: 3 },
];

const Dashboard = () => {
  const { currentWorkspace } = useAuth();

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Nenhum workspace disponível</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não possui um workspace ativo. Faça login novamente ou entre em contato com o suporte.
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
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    kpi.up ? "text-success" : "text-destructive"
                  }`}
                >
                  {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.change}
                </span>
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
              {funnelData.map((item, i) => {
                const maxVal = funnelData[0].value;
                const pct = (item.value / maxVal) * 100;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Reasons Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Motivos de Inatividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reasonsData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      {reasonsData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {reasonsData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="ml-auto font-medium text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Performance por Operador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operatorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="disparos" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="reativacoes" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
