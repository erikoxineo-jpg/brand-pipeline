import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Send, Filter, MessageSquare, Loader2, RefreshCw, Megaphone, Brain, ChevronDown, ChevronUp, Check, X, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api/client";
import { getSocket } from "@/lib/api/socket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-warning/10 text-warning" },
  sent: { label: "Enviado", className: "bg-primary/10 text-primary" },
  delivered: { label: "Entregue", className: "bg-primary/10 text-primary" },
  read: { label: "Lido", className: "bg-chart-4/10 text-chart-4" },
  replied: { label: "Respondeu", className: "bg-success/10 text-success" },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive" },
};

const aiClassConfig: Record<string, { label: string; className: string }> = {
  positive: { label: "Positivo", className: "bg-success/10 text-success" },
  negative: { label: "Negativo", className: "bg-destructive/10 text-destructive" },
  question: { label: "Dúvida", className: "bg-primary/10 text-primary" },
  opt_out: { label: "Opt-out", className: "bg-secondary text-muted-foreground" },
  greeting: { label: "Saudação", className: "bg-chart-4/10 text-chart-4" },
  other: { label: "Outro", className: "bg-secondary text-muted-foreground" },
};

const aiResponseStatusConfig: Record<string, { label: string; className: string }> = {
  auto_sent: { label: "Auto", className: "bg-chart-4/10 text-chart-4" },
  approved: { label: "OK", className: "bg-success/10 text-success" },
  edited: { label: "Edit", className: "bg-primary/10 text-primary" },
  rejected: { label: "Rej", className: "bg-destructive/10 text-destructive" },
  pending_review: { label: "Fila", className: "bg-warning/10 text-warning" },
};

const Dispatches = () => {
  const { currentWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const workspaceId = currentWorkspace?.id;

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [reviewOpen, setReviewOpen] = useState(true);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ["dispatches", workspaceId, search, statusFilter, campaignFilter],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (campaignFilter !== "all") params.set("campaign", campaignFilter);
      if (search) params.set("search", search);
      return apiFetch<any[]>(`/dispatches?${params}`);
    },
    enabled: !!workspaceId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-list", workspaceId],
    queryFn: () => apiFetch<any[]>("/campaigns"),
    enabled: !!workspaceId,
  });

  // Fetch pending AI reviews
  const { data: pendingReviews = [] } = useQuery({
    queryKey: ["pending-ai-reviews", workspaceId],
    queryFn: () => apiFetch<any[]>("/dispatches/pending-reviews"),
    enabled: !!workspaceId,
  });

  // AI review action mutation
  const aiReviewMutation = useMutation({
    mutationFn: async ({ dispatch_id, action, response_text }: { dispatch_id: string; action: string; response_text?: string }) => {
      return apiFetch("/dispatches/review", {
        method: "POST",
        body: JSON.stringify({ dispatch_id, action, response_text }),
      });
    },
    onSuccess: (_data: any, variables) => {
      const labels: Record<string, string> = { approve: "Aprovada", edit: "Editada e enviada", reject: "Rejeitada" };
      toast.success(`Resposta ${labels[variables.action] || variables.action}`);
      setEditingReview(null);
      queryClient.invalidateQueries({ queryKey: ["pending-ai-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  // Use ai_summary from dispatch data instead of fetching messages separately
  const lastReplies = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of dispatches as any[]) {
      if (d.ai_summary && d.lead_id && !map[d.lead_id]) {
        map[d.lead_id] = d.ai_summary;
      }
    }
    return map;
  }, [dispatches]);

  // Real-time subscription for dispatch status updates via Socket.io
  useEffect(() => {
    if (!workspaceId) return;
    const socket = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["pending-ai-reviews"] });
    };
    socket?.on("dispatch:updated", handler);
    return () => {
      socket?.off("dispatch:updated", handler);
    };
  }, [workspaceId, queryClient]);

  const filtered = dispatches.filter((d: any) => {
    if (!search) return true;
    const name = d.leads?.name?.toLowerCase() || "";
    const phone = d.leads?.phone || "";
    return name.includes(search.toLowerCase()) || phone.includes(search);
  });

  const pendingIds = filtered.filter((d: any) => d.status === "pending").map((d: any) => d.id);

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected((prev) => prev.length === pendingIds.length ? [] : [...pendingIds]);
  };

  const sendMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiFetch<any>("/dispatches/send", {
        method: "POST",
        body: JSON.stringify({ dispatch_ids: ids }),
      });
    },
    onSuccess: (data: any) => {
      const sent = data?.results?.filter((r: any) => r.status === "sent").length || 0;
      const failed = data?.results?.filter((r: any) => r.status === "failed").length || 0;
      toast.success(`${sent} enviado(s), ${failed} falha(s)`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleBatchSend = () => {
    if (selected.length === 0) return;
    sendMutation.mutate(selected);
  };

  const handleRetryFailed = async () => {
    const failedIds = filtered.filter((d: any) => d.status === "failed").map((d: any) => d.id);
    if (!failedIds.length) return;

    // Reset status to pending first, then send
    try {
      await Promise.all(
        failedIds.map((id: string) =>
          apiFetch(`/dispatches/${id}`, { method: "PATCH", body: JSON.stringify({ status: "pending", error_message: null }) })
        )
      );
      sendMutation.mutate(failedIds);
    } catch (err: any) {
      toast.error(`Erro ao resetar: ${err.message}`);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Nenhum workspace ativo.</p>
      </div>
    );
  }

  const failedCount = filtered.filter((d: any) => d.status === "failed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Disparos WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens 1:1 ou em lote</p>
        </div>
        <div className="flex gap-2">
          {failedCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleRetryFailed} disabled={sendMutation.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reenviar falhos ({failedCount})
            </Button>
          )}
          <Button size="sm" disabled={selected.length === 0 || sendMutation.isPending} onClick={handleBatchSend}>
            {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Disparar {selected.length > 0 && `(${selected.length})`}
          </Button>
        </div>
      </div>

      {/* AI Review Queue */}
      {pendingReviews.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <button
              onClick={() => setReviewOpen(!reviewOpen)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-warning" />
                <span className="font-medium text-foreground">
                  Respostas IA para revisão
                </span>
                <Badge variant="secondary" className="bg-warning/10 text-warning">
                  {pendingReviews.length}
                </Badge>
              </div>
              {reviewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardHeader>
          {reviewOpen && (
            <CardContent className="space-y-3 pt-0">
              {pendingReviews.map((d: any) => {
                const cls = aiClassConfig[d.ai_classification] || aiClassConfig.other;
                const isEditing = editingReview === d.id;
                return (
                  <div key={d.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.leads?.name || "Sem nome"}</span>
                        <span className="text-xs text-muted-foreground">{d.leads?.phone}</span>
                        <Badge variant="secondary" className={cls.className}>{cls.label}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{d.campaigns?.name}</span>
                    </div>

                    {/* Client message (last reply from messages query) */}
                    <div className="rounded bg-muted p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Mensagem do cliente:</p>
                      <p className="text-sm">{d.ai_summary || "—"}</p>
                    </div>

                    {/* AI suggested response */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Editar resposta:</p>
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    ) : (
                      <div className="rounded bg-primary/5 p-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Resposta sugerida pela IA:</p>
                        <p className="text-sm">{d.ai_suggested_response}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => aiReviewMutation.mutate({ dispatch_id: d.id, action: "reject" })}
                        disabled={aiReviewMutation.isPending}
                      >
                        <X className="mr-1 h-3 w-3" /> Rejeitar
                      </Button>
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingReview(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => aiReviewMutation.mutate({ dispatch_id: d.id, action: "edit", response_text: editText })}
                            disabled={aiReviewMutation.isPending || !editText.trim()}
                          >
                            {aiReviewMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            <Send className="mr-1 h-3 w-3" /> Enviar editada
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingReview(d.id); setEditText(d.ai_suggested_response || ""); }}
                          >
                            <Pencil className="mr-1 h-3 w-3" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => aiReviewMutation.mutate({ dispatch_id: d.id, action: "approve" })}
                            disabled={aiReviewMutation.isPending}
                          >
                            {aiReviewMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            <Check className="mr-1 h-3 w-3" /> Aprovar e Enviar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos status</option>
              {Object.entries(statusConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="all">Todas campanhas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.length > 0 && selected.length === pendingIds.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IA</TableHead>
                <TableHead>Última Resposta</TableHead>
                <TableHead className="w-20">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    {dispatches.length === 0 && !search && statusFilter === "all" && campaignFilter === "all" ? (
                      <div className="flex flex-col items-center gap-3">
                        <Send className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Nenhum disparo criado</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vá até Campanhas, selecione leads e crie disparos
                          </p>
                        </div>
                        <Button size="sm" onClick={() => navigate("/campaigns")}>
                          <Megaphone className="mr-2 h-4 w-4" /> Ir para Campanhas
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum disparo encontrado para esses filtros</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((dispatch: any) => {
                  const st = statusConfig[dispatch.status] || statusConfig.pending;
                  return (
                    <TableRow key={dispatch.id}>
                      <TableCell>
                        {dispatch.status === "pending" && (
                          <Checkbox
                            checked={selected.includes(dispatch.id)}
                            onCheckedChange={() => toggleSelect(dispatch.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{dispatch.leads?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{dispatch.leads?.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{dispatch.campaigns?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dispatch.sent_at ? new Date(dispatch.sent_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={st.className}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {dispatch.ai_classification ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className={aiClassConfig[dispatch.ai_classification]?.className || ""}>
                                    {aiClassConfig[dispatch.ai_classification]?.label || dispatch.ai_classification}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[200px] text-xs">{dispatch.ai_summary || "Sem resumo"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {dispatch.ai_response_status && aiResponseStatusConfig[dispatch.ai_response_status] && (
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${aiResponseStatusConfig[dispatch.ai_response_status].className}`}>
                              {aiResponseStatusConfig[dispatch.ai_response_status].label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {lastReplies[dispatch.lead_id]
                          ? lastReplies[dispatch.lead_id].slice(0, 50) + (lastReplies[dispatch.lead_id].length > 50 ? "..." : "")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {dispatch.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => sendMutation.mutate([dispatch.id])}
                            disabled={sendMutation.isPending}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Rate limit: max 20 msgs/min · Opt-out por palavras-chave: "parar", "sair", "cancelar"
      </p>
    </div>
  );
};

export default Dispatches;
