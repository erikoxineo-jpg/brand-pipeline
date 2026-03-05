import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Plus, Play, Pause, MessageSquare, HelpCircle, Gift, Loader2, Pencil, Trash2, RefreshCw, Send, Megaphone, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import CreateDispatchesDialog from "@/components/CreateDispatchesDialog";

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

type FollowupMessage = {
  delay_days: number;
  template: string;
};

const Campaigns = () => {
  const { currentWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dispatchCampaign, setDispatchCampaign] = useState<{ id: string; name: string } | null>(null);

  // Form state for editing
  const [editTemplate, setEditTemplate] = useState("");
  const [editQuestions, setEditQuestions] = useState<string[]>([]);
  const [editOfferType, setEditOfferType] = useState("");
  const [editOfferValue, setEditOfferValue] = useState("");
  const [editOfferRule, setEditOfferRule] = useState("");

  // Follow-up state
  const [editFollowupEnabled, setEditFollowupEnabled] = useState(false);
  const [editFollowupMessages, setEditFollowupMessages] = useState<FollowupMessage[]>([]);

  // Automation state
  const [editAutoDispatch, setEditAutoDispatch] = useState(true);
  const [editAutoRespond, setEditAutoRespond] = useState(false);
  const [editAutoRespondContext, setEditAutoRespondContext] = useState("");
  const [editMaxDaily, setEditMaxDaily] = useState(100);

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
        followup_enabled: editFollowupEnabled,
        followup_messages: editFollowupMessages as unknown as Json,
        auto_dispatch: editAutoDispatch,
        auto_respond: editAutoRespond,
        auto_respond_context: editAutoRespondContext || null,
        max_daily_dispatches: editMaxDaily,
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
    setEditFollowupEnabled(campaign.followup_enabled || false);
    const fMessages = Array.isArray(campaign.followup_messages)
      ? (campaign.followup_messages as unknown as FollowupMessage[])
      : [];
    setEditFollowupMessages(fMessages);
    setEditAutoDispatch(campaign.auto_dispatch ?? true);
    setEditAutoRespond(campaign.auto_respond ?? false);
    setEditAutoRespondContext(campaign.auto_respond_context || "");
    setEditMaxDaily(campaign.max_daily_dispatches ?? 100);
  };

  const editingCampaign = campaigns.find((c) => c.id === editingId);

  // Template preview
  const previewMessage = editTemplate
    .replace(/\{\{nome\}\}/g, "Maria")
    .replace(/\{\{dias\}\}/g, "120")
    .replace(/\{\{marca\}\}/g, currentWorkspace?.name || "Marca");

  const previewFollowup = (template: string) =>
    template
      .replace(/\{\{nome\}\}/g, "Maria")
      .replace(/\{\{dias\}\}/g, "120")
      .replace(/\{\{marca\}\}/g, currentWorkspace?.name || "Marca");

  const addFollowupMessage = () => {
    if (editFollowupMessages.length >= 2) return;
    setEditFollowupMessages([...editFollowupMessages, { delay_days: 3, template: "" }]);
  };

  const updateFollowupMessage = (index: number, field: keyof FollowupMessage, value: any) => {
    const next = [...editFollowupMessages];
    next[index] = { ...next[index], [field]: value };
    setEditFollowupMessages(next);
  };

  const removeFollowupMessage = (index: number) => {
    setEditFollowupMessages(editFollowupMessages.filter((_, i) => i !== index));
  };

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
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <Megaphone className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Nenhuma campanha ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie uma campanha para definir mensagens e selecionar leads para disparo
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Campanha
              </Button>
            </div>
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
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={statusColors[c.status] || ""}>
                          {statusLabels[c.status] || c.status}
                        </Badge>
                        {c.followup_enabled && (
                          <Badge variant="outline" className="text-[10px]">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Follow-up
                          </Badge>
                        )}
                        {c.auto_dispatch && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            <Bot className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(c)} title="Editar campanha">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setDispatchCampaign({ id: c.id, name: c.name })} title="Selecionar leads para disparo">
                        <Send className="h-4 w-4" />
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
                <TabsTrigger value="followup" className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Follow-up
                </TabsTrigger>
                <TabsTrigger value="automation" className="gap-2">
                  <Bot className="h-4 w-4" /> Automação
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

              <TabsContent value="followup" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ativar follow-up automático</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Envia lembretes automáticos para quem não respondeu
                    </p>
                  </div>
                  <Switch
                    checked={editFollowupEnabled}
                    onCheckedChange={setEditFollowupEnabled}
                  />
                </div>

                {editFollowupEnabled && (
                  <div className="space-y-4">
                    {editFollowupMessages.map((fm, i) => (
                      <div key={i} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Lembrete {i + 1}</Label>
                          <Button variant="ghost" size="sm" onClick={() => removeFollowupMessage(i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Enviar após (dias)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={fm.delay_days}
                            onChange={(e) => updateFollowupMessage(i, "delay_days", parseInt(e.target.value) || 1)}
                            className="w-24"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Mensagem</Label>
                          <Textarea
                            placeholder="Oi {{nome}}, ainda estamos por aqui..."
                            className="min-h-[80px]"
                            value={fm.template}
                            onChange={(e) => updateFollowupMessage(i, "template", e.target.value)}
                          />
                        </div>
                        {fm.template && (
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                            <p className="text-sm whitespace-pre-wrap">{previewFollowup(fm.template)}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {editFollowupMessages.length < 2 && (
                      <Button variant="outline" size="sm" onClick={addFollowupMessage}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Lembrete
                      </Button>
                    )}

                    {editFollowupMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Adicione até 2 lembretes automáticos. Leads que responderam não receberão follow-ups.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="automation" className="space-y-5 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-dispatch</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sistema seleciona leads elegíveis automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={editAutoDispatch}
                    onCheckedChange={setEditAutoDispatch}
                  />
                </div>

                {editAutoDispatch && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max disparos/dia</Label>
                      <span className="text-sm font-medium text-foreground">{editMaxDaily}</span>
                    </div>
                    <Slider
                      value={[editMaxDaily]}
                      onValueChange={([v]) => setEditMaxDaily(v)}
                      min={10}
                      max={500}
                      step={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Limite diário de novos disparos criados automaticamente
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Resposta automática (IA)</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        IA classifica respostas e responde automaticamente
                      </p>
                    </div>
                    <Switch
                      checked={editAutoRespond}
                      onCheckedChange={setEditAutoRespond}
                    />
                  </div>
                </div>

                {editAutoRespond && (
                  <div className="space-y-2">
                    <Label>Contexto do negócio</Label>
                    <Textarea
                      placeholder="Descreva seu negócio para a IA: produtos, preços, horários de funcionamento, endereço, formas de pagamento..."
                      className="min-h-[100px]"
                      value={editAutoRespondContext}
                      onChange={(e) => setEditAutoRespondContext(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Essas informações ajudam a IA a responder com contexto relevante
                    </p>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-3 mt-4">
                  <p className="text-xs text-muted-foreground">
                    Quando ativada, a campanha vai automaticamente: selecionar leads elegíveis, enviar mensagens, classificar respostas com IA, e enviar follow-ups. O motor roda a cada 5 minutos.
                  </p>
                </div>
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

      {/* Create Dispatches Dialog */}
      {dispatchCampaign && workspaceId && (
        <CreateDispatchesDialog
          campaignId={dispatchCampaign.id}
          campaignName={dispatchCampaign.name}
          workspaceId={workspaceId}
          open={!!dispatchCampaign}
          onOpenChange={(open) => { if (!open) setDispatchCampaign(null); }}
        />
      )}
    </div>
  );
};

export default Campaigns;
