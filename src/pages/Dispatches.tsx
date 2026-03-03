import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, Filter, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const dispatchLeads = [
  { id: 1, name: "Maria Silva", phone: "+5511999887766", stage: "Pronto para contato", campaign: "Reativação Janeiro", lastMsg: null, status: "pending" },
  { id: 7, name: "Fernanda Costa", phone: "+5511933221100", stage: "Pronto para contato", campaign: "Reativação Janeiro", lastMsg: null, status: "pending" },
  { id: 9, name: "Beatriz Nunes", phone: "+5511900112233", stage: "Pronto para contato", campaign: "Reativação Janeiro", lastMsg: null, status: "pending" },
  { id: 2, name: "João Santos", phone: "+5511988776655", stage: "Contactado", campaign: "Reativação Janeiro", lastMsg: "2025-02-10 14:32", status: "sent" },
  { id: 3, name: "Ana Oliveira", phone: "+5511977665544", stage: "Respondeu", campaign: "Pesquisa Satisfação", lastMsg: "2025-02-09 11:20", status: "replied" },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-warning/10 text-warning" },
  sent: { label: "Enviado", className: "bg-primary/10 text-primary" },
  replied: { label: "Respondeu", className: "bg-success/10 text-success" },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive" },
};

const Dispatches = () => {
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const toggleSelect = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const pendingIds = dispatchLeads.filter((l) => l.status === "pending").map((l) => l.id);
    setSelected((prev) => (prev.length === pendingIds.length ? [] : pendingIds));
  };

  const handleBatchSend = () => {
    toast({ title: `Disparando para ${selected.length} leads`, description: "Rate limit: 20 msgs/min" });
    setSelected([]);
  };

  const handleSingleSend = (name: string) => {
    toast({ title: `Mensagem enviada para ${name}` });
  };

  const filtered = dispatchLeads.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Disparos WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens 1:1 ou em lote</p>
        </div>
        <Button size="sm" disabled={selected.length === 0} onClick={handleBatchSend}>
          <Send className="mr-2 h-4 w-4" />
          Disparar {selected.length > 0 && `(${selected.length})`}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.length === dispatchLeads.filter((l) => l.status === "pending").length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Último Envio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const st = statusConfig[lead.status];
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      {lead.status === "pending" && (
                        <Checkbox checked={selected.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.campaign}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.lastMsg || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={st.className}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {lead.status === "pending" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSingleSend(lead.name)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⚠️ Rate limit: máx. 20 mensagens/minuto · Opt-out por palavras-chave: "parar", "sair", "cancelar"
      </p>
    </div>
  );
};

export default Dispatches;
