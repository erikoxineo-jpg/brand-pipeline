import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock } from "lucide-react";

const stages = [
  {
    name: "Pronto para contato",
    color: "bg-primary",
    leads: [
      { id: 1, name: "Maria Silva", phone: "+5511999887766", days: 180 },
      { id: 7, name: "Fernanda Costa", phone: "+5511933221100", days: 221 },
      { id: 9, name: "Beatriz Nunes", phone: "+5511900112233", days: 150 },
    ],
  },
  {
    name: "Contactado",
    color: "bg-chart-4",
    leads: [
      { id: 2, name: "João Santos", phone: "+5511988776655", days: 133 },
      { id: 10, name: "Pedro Mendes", phone: "+5511911223344", days: 98 },
    ],
  },
  {
    name: "Respondeu",
    color: "bg-warning",
    leads: [
      { id: 3, name: "Ana Oliveira", phone: "+5511977665544", days: 236 },
    ],
  },
  {
    name: "Reativado",
    color: "bg-success",
    leads: [
      { id: 6, name: "Roberto Alves", phone: "+5511944332211", days: 143 },
    ],
  },
  {
    name: "Opt-out",
    color: "bg-destructive",
    leads: [
      { id: 5, name: "Paula Lima", phone: "+5511955443322", days: 286 },
    ],
  },
];

const Pipeline = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Visão Kanban das etapas de reativação</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.name} className="min-w-[280px] flex-shrink-0">
            <div className="mb-3 flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <h3 className="text-sm font-medium text-foreground">{stage.name}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {stage.leads.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {stage.leads.map((lead) => (
                <Card key={lead.id} className="cursor-grab hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm text-foreground">{lead.name}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.phone.slice(-4)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lead.days}d inativo
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pipeline;
