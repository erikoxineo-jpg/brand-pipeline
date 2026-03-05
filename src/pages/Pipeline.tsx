import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Clock, X, MessageSquare } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
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

const stageBadgeColors: Record<string, string> = {
  imported: "bg-secondary text-secondary-foreground",
  eligible: "bg-warning/10 text-warning",
  ready: "bg-primary/10 text-primary",
  contacted: "bg-chart-4/10 text-chart-4",
  replied: "bg-success/10 text-success",
  reactivated: "bg-success/10 text-success",
  optout: "bg-destructive/10 text-destructive",
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

type Message = {
  id: string;
  direction: string;
  body: string;
  status: string;
  created_at: string;
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

function ChatThread({ leadId, workspaceId }: { leadId: string; workspaceId: string }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["lead-messages", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, direction, body, status, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-lead-${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["lead-messages", leadId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <MessageSquare className="h-8 w-8" />
        <p className="text-sm">Nenhuma mensagem ainda</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
      {messages.map((msg) => {
        const isOutbound = msg.direction === "outbound";
        const time = new Date(msg.created_at).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        return (
          <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                isOutbound
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
              <p className={`text-[10px] mt-1 ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {time}
                {isOutbound && msg.status && (
                  <span className="ml-1">
                    {msg.status === "sent" && "·"}
                    {msg.status === "delivered" && "··"}
                    {msg.status === "read" && "✓✓"}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
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

  // Lead dispatches for detail drawer
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

      {/* Lead Conversation Drawer */}
      <Sheet open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          {detailLead && (
            <>
              {/* Header */}
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-base">{detailLead.name || "Lead"}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{detailLead.phone || "—"}</span>
                      <Badge variant="secondary" className={`text-[10px] ${stageBadgeColors[detailLead.stage] || ""}`}>
                        {stageLabels[detailLead.stage] || detailLead.stage}
                      </Badge>
                      {detailLead.days_inactive != null && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {detailLead.days_inactive}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Lead Info */}
              <div className="px-6 py-3 border-b">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">E-mail:</span>
                    <p className="font-medium">{detailLead.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última compra:</span>
                    <p className="font-medium">{detailLead.last_purchase || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <ChatThread leadId={detailLead.id} workspaceId={workspaceId!} />

              {/* Dispatch History */}
              <div className="border-t px-6 py-3">
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">Histórico de Disparos</h4>
                {leadDispatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum disparo</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {leadDispatches.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate">{d.campaigns?.name || "—"}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                          <span className="text-muted-foreground">
                            {d.sent_at ? new Date(d.sent_at).toLocaleDateString("pt-BR") : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Pipeline;
