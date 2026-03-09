import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Phone, Mail, ChevronLeft, ChevronRight, Ban, Upload, Users, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STAGES = ["imported", "eligible", "ready", "contacted", "replied", "reactivated", "optout"] as const;

const stageLabels: Record<string, string> = {
  imported: "Importado",
  eligible: "Elegível",
  ready: "Pronto para contato",
  contacted: "Contactado",
  replied: "Respondeu",
  reactivated: "Reativado",
  optout: "Opt-out",
};

const stageColors: Record<string, string> = {
  imported: "bg-secondary text-secondary-foreground",
  eligible: "bg-warning/10 text-warning",
  ready: "bg-primary/10 text-primary",
  contacted: "bg-chart-4/10 text-chart-4",
  replied: "bg-success/10 text-success",
  reactivated: "bg-success text-success-foreground",
  optout: "bg-destructive/10 text-destructive",
};

const PAGE_SIZE = 20;

const Leads = () => {
  const { currentWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const workspaceId = currentWorkspace?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["leads", workspaceId, search, stageFilter, page],
    queryFn: async () => {
      if (!workspaceId) return { leads: [], count: 0 };
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (stageFilter !== "all") params.set("stage", stageFilter);
      params.set("page", String(page + 1));
      params.set("limit", String(PAGE_SIZE));
      const result = await apiFetch<{ data: any[]; total: number }>(`/leads?${params}`);
      return { leads: result.data || [], count: result.total || 0 };
    },
    enabled: !!workspaceId,
  });

  const leads = data?.leads || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-leads"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["dashboard-leads"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["checklist-leads"], refetchType: "all" });
  };

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const updates: any = { stage };
      if (stage === "optout") updates.opt_out = true;
      if (stage !== "optout") updates.opt_out = false;
      await apiFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    },
    onSuccess: () => {
      invalidateAll();
      setEditingStage(null);
      toast.success("Stage atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiFetch("/leads/bulk", { method: "DELETE", body: JSON.stringify({ ids }) });
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} lead(s) excluído(s)`);
      setSelected([]);
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const deleteAllFilteredMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return 0;
      const params = new URLSearchParams();
      if (stageFilter !== "all") params.set("stage", stageFilter);
      if (search) params.set("search", search);
      await apiFetch(`/leads/filtered?${params}`, { method: "DELETE" });
      return 0;
    },
    onSuccess: () => {
      toast.success("Leads excluídos com sucesso");
      setSelected([]);
      setPage(0);
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const handleDeleteSelected = () => {
    if (!selected.length) return;
    if (!confirm(`Excluir ${selected.length} lead(s)? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(selected);
  };

  const handleDeleteAllFiltered = () => {
    const label = stageFilter !== "all" ? stageLabels[stageFilter] : "todos";
    const msg = search
      ? `Excluir TODOS os leads que correspondem à busca "${search}"${stageFilter !== "all" ? ` e etapa "${stageLabels[stageFilter]}"` : ""}? (${totalCount} leads)`
      : `Excluir TODOS os ${totalCount} leads com etapa "${label}"? Esta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;
    deleteAllFilteredMutation.mutate();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const pageIds = leads.map((l) => l.id);
    const allSelected = pageIds.every((id) => selected.includes(id));
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleExportCSV = () => {
    if (!leads.length) return;
    const csvHeaders = ["Nome", "Telefone", "E-mail", "Última Compra", "Dias Inativo", "Etapa"];
    const csvRows = leads.map((l) => [
      l.name || "",
      l.phone || "",
      l.email || "",
      l.last_purchase || "",
      String(l.days_inactive ?? ""),
      stageLabels[l.stage] || l.stage,
    ]);
    const csvContent = [csvHeaders, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Nenhum workspace ativo.</p>
      </div>
    );
  }

  const isDeleting = deleteMutation.isPending || deleteAllFilteredMutation.isPending;
  const pageIds = leads.map((l) => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{totalCount} leads na base</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir ({selected.length})
            </Button>
          )}
          {totalCount > 0 && (stageFilter !== "all" || search) && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeleteAllFiltered} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir todos ({totalCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Todas etapas</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{stageLabels[s]}</option>
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
                    checked={allPageSelected}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead>Dias Inativo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    {!search && stageFilter === "all" ? (
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Nenhum lead importado</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Importe sua lista de clientes para começar
                          </p>
                        </div>
                        <Button size="sm" onClick={() => navigate("/imports")}>
                          <Upload className="mr-2 h-4 w-4" /> Importar Leads
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum lead encontrado para esses filtros</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className={selected.includes(lead.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {lead.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {lead.email ? (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {lead.email}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.last_purchase || "—"}</TableCell>
                    <TableCell>
                      {lead.days_inactive != null ? (
                        <span className={lead.days_inactive > 180 ? "text-destructive font-medium" : "text-foreground"}>
                          {lead.days_inactive}d
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {editingStage === lead.id ? (
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          value={lead.stage}
                          autoFocus
                          onChange={(e) => updateStageMutation.mutate({ id: lead.id, stage: e.target.value })}
                          onBlur={() => setEditingStage(null)}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{stageLabels[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={`cursor-pointer ${stageColors[lead.stage] || ""}`}
                          onClick={() => setEditingStage(lead.id)}
                        >
                          {stageLabels[lead.stage] || lead.stage}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!lead.opt_out && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Marcar como Opt-out"
                            onClick={() => updateStageMutation.mutate({ id: lead.id, stage: "optout" })}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir lead"
                          onClick={() => {
                            if (confirm(`Excluir "${lead.name || lead.phone}"?`)) {
                              deleteMutation.mutate([lead.id]);
                            }
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages} ({totalCount} leads)
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
