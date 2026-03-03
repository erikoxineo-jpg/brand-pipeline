import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock } from "lucide-react";

const importHistory = [
  { id: 1, file: "clientes_jan2025.xlsx", date: "2025-01-15 14:32", total: 1250, new: 980, dupes: 270, status: "success" },
  { id: 2, file: "base_reativacao.xlsx", date: "2025-01-10 09:15", total: 3200, new: 2800, dupes: 400, status: "success" },
  { id: 3, file: "leads_parceiro.xlsx", date: "2025-01-05 16:45", total: 500, new: 0, dupes: 0, status: "error" },
  { id: 4, file: "clientes_dez2024.xlsx", date: "2024-12-20 11:00", total: 890, new: 750, dupes: 140, status: "success" },
];

const previewData = [
  { col_a: "Maria Silva", col_b: "11999887766", col_c: "maria@email.com", col_d: "2024-08-15" },
  { col_a: "João Santos", col_b: "11988776655", col_c: "joao@email.com", col_d: "2024-10-01" },
  { col_a: "Ana Oliveira", col_b: "11977665544", col_c: "ana@email.com", col_d: "2024-06-20" },
];

const Imports = () => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Importações</h1>
        <p className="text-sm text-muted-foreground">Upload e histórico de arquivos .xlsx</p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-8">
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            onClick={() => setShowPreview(true)}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Arraste um arquivo .xlsx ou clique para selecionar</p>
            <p className="mt-1 text-xs text-muted-foreground">Suporta arquivos até 10MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview & Mapping */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview & Mapeamento</CardTitle>
            <CardDescription>Mapeie as colunas do arquivo para os campos do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <select className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                        <option>→ Nome</option>
                        <option>→ Telefone</option>
                        <option>→ E-mail</option>
                        <option>→ Última Compra</option>
                        <option>Ignorar</option>
                      </select>
                    </TableHead>
                    <TableHead>
                      <select className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                        <option>→ Telefone</option>
                        <option>→ Nome</option>
                        <option>→ E-mail</option>
                        <option>→ Última Compra</option>
                        <option>Ignorar</option>
                      </select>
                    </TableHead>
                    <TableHead>
                      <select className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                        <option>→ E-mail</option>
                        <option>→ Nome</option>
                        <option>→ Telefone</option>
                        <option>→ Última Compra</option>
                        <option>Ignorar</option>
                      </select>
                    </TableHead>
                    <TableHead>
                      <select className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                        <option>→ Última Compra</option>
                        <option>→ Nome</option>
                        <option>→ Telefone</option>
                        <option>→ E-mail</option>
                        <option>Ignorar</option>
                      </select>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.col_a}</TableCell>
                      <TableCell>{row.col_b}</TableCell>
                      <TableCell>{row.col_c}</TableCell>
                      <TableCell>{row.col_d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Telefones serão normalizados para E.164 · Duplicatas por telefone serão ignoradas
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
                  Cancelar
                </Button>
                <Button size="sm">Importar 3 leads</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Novos</TableHead>
                <TableHead>Duplicatas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importHistory.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-success" />
                      {imp.file}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{imp.date}</TableCell>
                  <TableCell>{imp.total.toLocaleString()}</TableCell>
                  <TableCell className="text-success">{imp.new.toLocaleString()}</TableCell>
                  <TableCell className="text-warning">{imp.dupes.toLocaleString()}</TableCell>
                  <TableCell>
                    {imp.status === "success" ? (
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Concluído
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        <XCircle className="mr-1 h-3 w-3" /> Erro
                      </Badge>
                    )}
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

export default Imports;
