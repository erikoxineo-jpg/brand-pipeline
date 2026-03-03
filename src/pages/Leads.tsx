import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Download, Phone, Mail } from "lucide-react";

const mockLeads = [
  { id: 1, name: "Maria Silva", phone: "+5511999887766", email: "maria@email.com", lastPurchase: "2024-08-15", daysInactive: 180, stage: "Pronto para contato", optOut: false },
  { id: 2, name: "João Santos", phone: "+5511988776655", email: "joao@email.com", lastPurchase: "2024-10-01", daysInactive: 133, stage: "Contactado", optOut: false },
  { id: 3, name: "Ana Oliveira", phone: "+5511977665544", email: "ana@email.com", lastPurchase: "2024-06-20", daysInactive: 236, stage: "Respondeu", optOut: false },
  { id: 4, name: "Carlos Souza", phone: "+5511966554433", email: "carlos@email.com", lastPurchase: "2024-11-10", daysInactive: 93, stage: "Elegível", optOut: false },
  { id: 5, name: "Paula Lima", phone: "+5511955443322", email: "paula@email.com", lastPurchase: "2024-05-01", daysInactive: 286, stage: "Opt-out", optOut: true },
  { id: 6, name: "Roberto Alves", phone: "+5511944332211", email: "roberto@email.com", lastPurchase: "2024-09-22", daysInactive: 143, stage: "Reativado", optOut: false },
  { id: 7, name: "Fernanda Costa", phone: "+5511933221100", email: "fernanda@email.com", lastPurchase: "2024-07-05", daysInactive: 221, stage: "Pronto para contato", optOut: false },
  { id: 8, name: "Lucas Pereira", phone: "+5511922110099", email: "lucas@email.com", lastPurchase: "2024-12-01", daysInactive: 62, stage: "Importado", optOut: false },
];

const stageColors: Record<string, string> = {
  "Importado": "bg-secondary text-secondary-foreground",
  "Elegível": "bg-warning/10 text-warning",
  "Pronto para contato": "bg-primary/10 text-primary",
  "Contactado": "bg-chart-4/10 text-chart-4",
  "Respondeu": "bg-success/10 text-success",
  "Reativado": "bg-success text-success-foreground",
  "Opt-out": "bg-destructive/10 text-destructive",
};

const Leads = () => {
  const [search, setSearch] = useState("");

  const filtered = mockLeads.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{mockLeads.length} leads na base</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
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
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead>Dias Inativo</TableHead>
                <TableHead>Etapa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer">
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {lead.phone}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {lead.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.lastPurchase}</TableCell>
                  <TableCell>
                    <span className={lead.daysInactive > 180 ? "text-destructive font-medium" : "text-foreground"}>
                      {lead.daysInactive}d
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={stageColors[lead.stage] || ""}>
                      {lead.stage}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
