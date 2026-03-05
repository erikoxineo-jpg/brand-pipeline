import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STAGE_OPTIONS = [
  { value: "eligible", label: "Elegível" },
  { value: "ready", label: "Pronto para contato" },
  { value: "imported", label: "Importado" },
  { value: "contacted", label: "Contactado" },
  { value: "replied", label: "Respondeu" },
  { value: "reactivated", label: "Reativado" },
];

const stageColors: Record<string, string> = {
  imported: "bg-secondary text-secondary-foreground",
  eligible: "bg-warning/10 text-warning",
  ready: "bg-primary/10 text-primary",
  contacted: "bg-chart-4/10 text-chart-4",
  replied: "bg-success/10 text-success",
  reactivated: "bg-success text-success-foreground",
};

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  days_inactive: number | null;
  stage: string;
};

export default function CreateDispatchesDialog({
  campaignId,
  campaignName,
  workspaceId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  campaignName: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>(["eligible", "ready"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Fetch existing dispatch lead_ids for this campaign
  const { data: existingLeadIds = new Set<string>() } = useQuery({
    queryKey: ["dispatch-leads", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatches")
        .select("lead_id")
        .eq("campaign_id", campaignId)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return new Set((data || []).map((d) => d.lead_id));
    },
    enabled: open,
  });

  // Fetch available leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["available-leads", workspaceId, stageFilter],
    queryFn: async () => {
      if (!stageFilter.length) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, days_inactive, stage")
        .eq("workspace_id", workspaceId)
        .eq("opt_out", false)
        .in("stage", stageFilter)
        .order("days_inactive", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: open && stageFilter.length > 0,
  });

  // Filter out already dispatched + search
  const availableLeads = useMemo(() => {
    return leads.filter((l) => {
      if (existingLeadIds.has(l.id)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (l.name?.toLowerCase().includes(q)) || (l.phone?.includes(q));
    });
  }, [leads, existingLeadIds, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === availableLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableLeads.map((l) => l.id)));
    }
  };

  const toggleStage = (stage: string) => {
    setStageFilter((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
    setSelected(new Set());
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const leadIds = Array.from(selected);
      const rows = leadIds.map((lead_id) => ({
        workspace_id: workspaceId,
        lead_id,
        campaign_id: campaignId,
        status: "pending",
      }));

      // Insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase
          .from("dispatches")
          .insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      return leadIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} disparos criados para "${campaignName}"`);
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch-leads"] });
      setSelected(new Set());
      onOpenChange(false);
      navigate("/dispatches");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Leads</DialogTitle>
          <DialogDescription>
            Campanha: <strong>{campaignName}</strong> — Escolha os leads para criar disparos
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={stageFilter.includes(opt.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleStage(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Leads Table */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={availableLeads.length > 0 && selected.size === availableLeads.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Dias Inativo</TableHead>
                <TableHead>Etapa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : availableLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8" />
                      <p className="text-sm">
                        {leads.length > 0 && existingLeadIds.size > 0
                          ? "Todos os leads já foram adicionados a esta campanha"
                          : "Nenhum lead disponível para esses filtros"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                availableLeads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => toggleSelect(lead.id)}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.name || "Sem nome"}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.phone || "—"}</TableCell>
                    <TableCell>
                      {lead.days_inactive != null ? (
                        <span className={lead.days_inactive > 180 ? "text-destructive font-medium" : ""}>
                          {lead.days_inactive}d
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={stageColors[lead.stage] || ""}>
                        {STAGE_OPTIONS.find((o) => o.value === lead.stage)?.label || lead.stage}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} lead${selected.size > 1 ? "s" : ""} selecionado${selected.size > 1 ? "s" : ""}`
              : `${availableLeads.length} leads disponíveis`}
          </p>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={selected.size === 0 || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Criar {selected.size > 0 ? `${selected.size} ` : ""}Disparos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
