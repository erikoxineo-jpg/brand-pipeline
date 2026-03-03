import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Pause, MessageSquare, HelpCircle, Gift } from "lucide-react";

const campaigns = [
  { id: 1, name: "Reativação Janeiro", status: "active", leads: 450, sent: 320, replied: 110 },
  { id: 2, name: "Pesquisa Satisfação", status: "paused", leads: 200, sent: 150, replied: 45 },
  { id: 3, name: "Black Friday Retorno", status: "completed", leads: 800, sent: 800, replied: 280 },
];

const Campaigns = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Configure mensagens, pesquisas e ofertas</p>
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Active Campaigns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{c.name}</h3>
                  <Badge
                    variant="secondary"
                    className={
                      c.status === "active"
                        ? "mt-1 bg-success/10 text-success"
                        : c.status === "paused"
                        ? "mt-1 bg-warning/10 text-warning"
                        : "mt-1 bg-secondary text-muted-foreground"
                    }
                  >
                    {c.status === "active" ? "Ativa" : c.status === "paused" ? "Pausada" : "Concluída"}
                  </Badge>
                </div>
                {c.status === "active" ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : c.status === "paused" ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold text-foreground">{c.leads}</p>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{c.sent}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-primary">{c.replied}</p>
                  <p className="text-xs text-muted-foreground">Respostas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurar Campanha</CardTitle>
          <CardDescription>Defina as mensagens, pesquisa e oferta</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="message">
            <TabsList>
              <TabsTrigger value="message" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensagem
              </TabsTrigger>
              <TabsTrigger value="survey" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Pesquisa
              </TabsTrigger>
              <TabsTrigger value="offer" className="gap-2">
                <Gift className="h-4 w-4" />
                Oferta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="message" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Mensagem Inicial</Label>
                <Textarea
                  placeholder="Olá {{nome}}, sentimos sua falta! Faz {{dias}} dias desde sua última visita..."
                  className="min-h-[100px]"
                  defaultValue="Olá {{nome}}, tudo bem? 😊 Faz um tempinho que não nos visitamos! Sentimos sua falta. Podemos te fazer 2 perguntas rápidas?"
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{{nome}}"}, {"{{dias}}"}, {"{{marca}}"}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="survey" className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Pergunta 1</Label>
                  <Input defaultValue="O que fez você parar de comprar conosco?" />
                </div>
                <div className="space-y-2">
                  <Label>Pergunta 2</Label>
                  <Input defaultValue="O que podemos fazer para te reconquistar?" />
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Pergunta
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="offer" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Oferta</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Cupom de desconto</option>
                    <option>Frete grátis</option>
                    <option>Brinde</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Valor / Código</Label>
                  <Input defaultValue="VOLTEI15" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Regra de ativação</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>Enviar para quem respondeu a pesquisa</option>
                  <option>Enviar para todos os contactados</option>
                  <option>Enviar apenas se motivo = "Preço"</option>
                </select>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Campaigns;
