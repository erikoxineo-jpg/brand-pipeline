import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, Filter, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

const Dispatches = () => {
  const { currentWorkspace, session } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ["dispatches", workspaceId, search, statusFilter, campaignFilter],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from("dispatches")
        .select("*, leads(name, phone), campaigns(name)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (campaignFilter !== "all") {
        query = query.eq("campaign_id", campaignFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-list", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Fetch last inbound message per lead for dispatches
  const leadIds = useMemo(() => [...new Set(dispatches.map((d: any) => d.lead_id))], [dispatches]);
  const { data: lastReplies = {} } = useQuery({
    queryKey: ["last-replies", leadIds],
    queryFn: async () => {
      if (!leadIds.length) return {};
      // Fetch the most recent inbound message for each lead
      const { data, error } = await supabase
        .from("messages")
        .select("lead_id, body, created_at")
        .in("lead_id", leadIds)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Keep only the latest per lead
      const map: Record<string, string> = {};
      for (const msg of data || []) {
        if (!map[msg.lead_id]) {
          map[msg.lead_id] = msg.body;
        }
      }
      return map;
    },
    enabled: leadIds.length > 0,
  });

  // Real-time subscription for dispatch status updates
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel("dispatches-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dispatches", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dispatches"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { dispatch_ids: ids },
      });
      if (error) throw error;
      return data;
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

  const handleRetryFailed = () => {
    const failedIds = filtered.filter((d: any) => d.status === "failed").map((d: any) => d.id);
    if (!failedIds.length) return;

    // Reset status to pending first, then send
    Promise.all(
      failedIds.map((id: string) =>
        supabase.from("dispatches").update({ status: "pending", error_message: null }).eq("id", id)
      )
    ).then(() => {
      sendMutation.mutate(failedIds);
    });
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
                <TableHead>Última Resposta</TableHead>
                <TableHead className="w-20">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum disparo encontrado</TableCell>
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
