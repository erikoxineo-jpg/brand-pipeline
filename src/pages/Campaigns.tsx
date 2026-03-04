import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Play, Pause, MessageSquare, HelpCircle, Gift, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
};

const statusColors: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  completed: "bg-secondary text-muted-foreground",
};

const Campaigns = () => {
  const { currentWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for editing
  const [editTemplate, setEditTemplate] = useState("");
  const [editQuestions, setEditQuestions] = useState<string[]>([]);
  const [editOfferType, setEditOfferType] = useState("");
  const [editOfferValue, setEditOfferValue] = useState("");
  const [editOfferRule, setEditOfferRule] = useState("");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Dispatch stats per campaign
  const { data: dispatchStats = {} } = useQuery({
    queryKey: ["campaign-stats", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const { data, error } = await supabase
        .from("dispatches")
        .select("campaign_id, status")
        .eq("workspace_id", workspaceId);
      if (error) throw error;

      const stats: Record<string, { total: number; sent: number; replied: number }> = {};
      for (const d of data || []) {
        if (!d.campaign_id) continue;
        if (!stats[d.campaign_id]) stats[d.campaign_id] = { total: 0, sent: 0, replied: 0 };
        stats[d.campaign_id].total++;
        if (["sent", "delivered", "read", "replied"].includes(d.status)) stats[d.campaign_id].sent++;
        if (d.status === "replied") stats[d.campaign_id].replied++;
      }
      return stats;
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      const { error } = await supabase.from("campaigns").insert({
        workspace_id: workspaceId,
        name: newName,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCreateOpen(false);
      setNewName("");
      toast.success("Campanha criada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from("campaigns").update({
        message_template: editTemplate,
        survey_questions: editQuestions as unknown as Json,
        offer_type: editOfferType || null,
        offer_value: editOfferValue || null,
        offer_rule: editOfferRule || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha salva");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setEditingId(null);
      toast.success("Campanha excluída");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEditing = (campaign: typeof campaigns[0]) => {
    setEditingId(campaign.id);
    setEditTemplate(campaign.message_template || "");
    const questions = Array.isArray(campaign.survey_questions) ? (campaign.survey_questions as string[]) : [];
    setEditQuestions(questions.length ? questions : ["", ""]);
    setEditOfferType(campaign.offer_type || "");
    setEditOfferValue(campaign.offer_value || "");
    setEditOfferRule(campaign.offer_rule || "");
  };

  const editingCampaign = campaigns.find((c) => c.id === editingId);

  // Template preview
  const previewMessage = editTemplate
    .replace(/\{\{nome\}\}/g, "Maria")
    .replace(/\{\{dias\}\}/g, "120")
    .replace(/\{\{marca\}\}/g, currentWorkspace?.name || "Marca");

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Nenhum workspace ativo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Configure mensagens, pesquisas e ofertas</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Campanha</DialogTitle>
              <DialogDescription>Dê um nome à campanha para começar</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Nome da campanha"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma campanha ainda. Crie a primeira!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {campaigns.map((c) => {
            const stats = dispatchStats[c.id] || { total: 0, sent: 0, replied: 0 };
            return (
              <Card key={c.id} className={editingId === c.id ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{c.name}</h3>
                      <Badge variant="secondary" className={`mt-1 ${statusColors[c.status] || ""}`}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {c.status === "active" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatusMutation.mutate({ id: c.id, status: "paused" })}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {(c.status === "paused" || c.status === "draft") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatusMutation.mutate({ id: c.id, status: "active" })}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{stats.sent}</p>
                      <p className="text-xs text-muted-foreground">Enviados</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-primary">{stats.replied}</p>
                      <p className="text-xs text-muted-foreground">Respostas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaign Editor */}
      {editingCampaign && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Editar: {editingCampaign.name}</CardTitle>
                <CardDescription>Defina as mensagens, pesquisa e oferta</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => {
                  if (confirm("Excluir esta campanha?")) deleteMutation.mutate(editingCampaign.id);
                }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="message">
              <TabsList>
                <TabsTrigger value="message" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Mensagem
                </TabsTrigger>
                <TabsTrigger value="survey" className="gap-2">
                  <HelpCircle className="h-4 w-4" /> Pesquisa
                </TabsTrigger>
                <TabsTrigger value="offer" className="gap-2">
                  <Gift className="h-4 w-4" /> Oferta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="message" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Mensagem Inicial</Label>
                  <Textarea
                    placeholder="Olá {{nome}}, sentimos sua falta! Faz {{dias}} dias..."
                    className="min-h-[100px]"
                    value={editTemplate}
                    onChange={(e) => setEditTemplate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {"{{nome}}"}, {"{{dias}}"}, {"{{marca}}"}
                  </p>
                </div>
                {editTemplate && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                    <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="survey" className="space-y-4 pt-4">
                <div className="space-y-3">
                  {editQuestions.map((q, i) => (
                    <div key={i} className="space-y-2">
                      <Label>Pergunta {i + 1}</Label>
                      <Input
                        value={q}
                        onChange={(e) => {
                          const next = [...editQuestions];
                          next[i] = e.target.value;
                          setEditQuestions(next);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditQuestions([...editQuestions, ""])}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Pergunta
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="offer" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Oferta</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editOfferType}
                      onChange={(e) => setEditOfferType(e.target.value)}
                    >
                      <option value="">Nenhuma</option>
                      <option value="coupon">Cupom de desconto</option>
                      <option value="shipping">Frete grátis</option>
                      <option value="gift">Brinde</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor / Código</Label>
                    <Input value={editOfferValue} onChange={(e) => setEditOfferValue(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Regra de ativação</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editOfferRule}
                    onChange={(e) => setEditOfferRule(e.target.value)}
                  >
                    <option value="">Sem regra</option>
                    <option value="replied">Enviar para quem respondeu a pesquisa</option>
                    <option value="contacted">Enviar para todos os contactados</option>
                    <option value="price_reason">Enviar apenas se motivo = "Preço"</option>
                  </select>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Campaigns;
