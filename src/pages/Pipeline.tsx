import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Clock, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PIPELINE_STAGES = ["imported", "eligible", "ready", "contacted", "replied", "reactivated", "optout"] as const;

const stageLabels: Record<string, string> = {
  imported: "Importado",
  eligible: "Elegível",
  ready: "Pronto para contato",
  contacted: "Contactado",
  replied: "Respondeu",
  reactivated: "Reativado",
  optout: "Opt-out",
};

const stageColorDot: Record<string, string> = {
  imported: "bg-secondary",
  eligible: "bg-warning",
  ready: "bg-primary",
  contacted: "bg-chart-4",
  replied: "bg-warning",
  reactivated: "bg-success",
  optout: "bg-destructive",
};

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  days_inactive: number | null;
  stage: string;
  email: string | null;
  last_purchase: string | null;
  opt_out: boolean;
};

function DroppableColumn({ stageId, children }: { stageId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] flex-shrink-0 rounded-lg p-2 transition-colors ${isOver ? "bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

function DraggableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab hover:shadow-md transition-shadow" onClick={onClick}>
        <CardContent className="p-4">
          <p className="font-medium text-sm text-foreground">{lead.name || "Sem nome"}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.phone ? lead.phone.slice(-4) : "—"}
            </span>
            {lead.days_inactive != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lead.days_inactive}d inativo
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const Pipeline = () => {
  const { currentWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["pipeline-leads", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, days_inactive, stage, email, last_purchase, opt_out")
        .eq("workspace_id", workspaceId)
        .in("stage", PIPELINE_STAGES as unknown as string[]);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!workspaceId,
  });

  // Lead dispatches for detail modal
  const { data: leadDispatches = [] } = useQuery({
    queryKey: ["lead-dispatches", detailLead?.id],
    queryFn: async () => {
      if (!detailLead) return [];
      const { data, error } = await supabase
        .from("dispatches")
        .select("*, campaigns(name)")
        .eq("lead_id", detailLead.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!detailLead,
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const updates: any = { stage };
      if (stage === "optout") updates.opt_out = true;
      const { error } = await supabase.from("leads").update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline-leads", workspaceId] });
      const previous = queryClient.getQueryData<Lead[]>(["pipeline-leads", workspaceId]);
      queryClient.setQueryData<Lead[]>(["pipeline-leads", workspaceId], (old) =>
        (old || []).map((l) => (l.id === id ? { ...l, stage } : l))
      );
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pipeline-leads", workspaceId], context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
    },
  });

  const leadsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage);
    return acc;
  }, {} as Record<string, Lead[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    let targetStage = String(over.id);

    // If dropped on a lead, find the stage of that lead
    if (!PIPELINE_STAGES.includes(targetStage as any)) {
      const targetLead = leads.find((l) => l.id === targetStage);
      if (targetLead) targetStage = targetLead.stage;
    }

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    updateStageMutation.mutate({ id: leadId, stage: targetStage });
  };

  const activeLead = leads.find((l) => l.id === activeId);

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Nenhum workspace ativo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Visão Kanban das etapas de reativação</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = leadsByStage[stage] || [];
              return (
                <DroppableColumn key={stage} stageId={stage}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${stageColorDot[stage]}`} />
                    <h3 className="text-sm font-medium text-foreground">{stageLabels[stage]}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stageLeads.length}
                    </Badge>
                  </div>
                  <SortableContext items={stageLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 min-h-[60px]">
                      {stageLeads.map((lead) => (
                        <DraggableCard key={lead.id} lead={lead} onClick={() => setDetailLead(lead)} />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeLead ? (
              <Card className="shadow-lg w-[280px]">
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{activeLead.name || "Sem nome"}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {activeLead.phone ? activeLead.phone.slice(-4) : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Lead Detail Modal */}
      <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailLead?.name || "Lead"}</DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{detailLead.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail:</span>
                  <p className="font-medium">{detailLead.email || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Última compra:</span>
                  <p className="font-medium">{detailLead.last_purchase || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dias inativo:</span>
                  <p className="font-medium">{detailLead.days_inactive ?? "—"}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Histórico de Disparos</h4>
                {leadDispatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum disparo ainda</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Campanha</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadDispatches.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs">{d.campaigns?.name || "—"}</TableCell>
                          <TableCell className="text-xs">{d.status}</TableCell>
                          <TableCell className="text-xs">
                            {d.sent_at ? new Date(d.sent_at).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pipeline;
