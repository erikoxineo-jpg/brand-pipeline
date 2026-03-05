import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type FieldMapping = "name" | "phone" | "email" | "last_purchase" | "ignore";

const FIELD_OPTIONS: { value: FieldMapping; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "last_purchase", label: "Última Compra" },
  { value: "ignore", label: "Ignorar" },
];

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) return `+${digits}`;
  if (digits.length >= 10 && digits.startsWith("55")) return `+${digits}`;
  return null;
}

function parseDate(raw: string | number | null): string | null {
  if (raw == null || raw === "") return null;
  const val = typeof raw === "string" ? raw.trim() : raw;

  // Excel serial number (e.g. 45689 = 2025-01-23)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // Excel epoch: 1899-12-30 (accounts for the 1900 leap year bug)
    const ms = (num - 25569) * 86400000; // 25569 = days from 1899-12-30 to 1970-01-01
    const d = new Date(ms);
    return d.toISOString().split("T")[0];
  }

  // Already a date string (ISO, dd/mm/yyyy, etc.)
  const str = String(val);

  // Handle dd/mm/yyyy or dd-mm-yyyy (common in BR)
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

function calcDaysInactive(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const Imports = () => {
  const { currentWorkspace, user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);

  const workspaceId = currentWorkspace?.id;

  // Fetch import history
  const { data: importHistory = [] } = useQuery({
    queryKey: ["imports", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("imports")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const handleFileSelect = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (json.length < 2) {
        toast.error("Arquivo vazio ou sem dados suficientes");
        return;
      }

      const hdrs = json[0].map(String);
      setHeaders(hdrs);
      setRawRows(json.slice(1, 6)); // preview first 5 rows

      // Helper: check if a value looks like a phone number
      const looksLikePhone = (v: string) => {
        const digits = v.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 13;
      };

      // Helper: check if a value looks like text (name)
      const looksLikeText = (v: string) => {
        if (!v.trim()) return false;
        if (looksLikePhone(v)) return false;
        if (v.includes("@")) return false;
        if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) return false;
        if (/^\d+([.,]\d+)?$/.test(v.trim())) return false;
        // Has at least some letters
        return /[a-zA-ZÀ-ÿ]/.test(v);
      };

      // Auto-guess by header name
      const guessFromHeader = (h: string): FieldMapping => {
        const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        // Name patterns
        if (lower.includes("nome") || lower.includes("name") || lower === "cliente" || lower === "client"
          || lower.includes("razao") || lower === "contato" || lower === "pessoa"
          || lower.includes("responsavel") || lower === "fantasia" || lower === "empresa") return "name";
        // Phone patterns
        if (lower.includes("tel") || lower.includes("phone") || lower.includes("cel")
          || lower.includes("whats") || lower === "mobile" || lower === "fone"
          || lower.includes("numero") || lower.includes("ddd")) return "phone";
        // Email
        if (lower.includes("email") || lower.includes("e-mail")) return "email";
        // Date
        if (lower.includes("compra") || lower.includes("purchase") || lower.includes("data")
          || lower.includes("date") || lower.includes("ultima") || lower.includes("pedido")) return "last_purchase";
        return "ignore";
      };

      const guessed: FieldMapping[] = hdrs.map((h) => guessFromHeader(h));

      // Sample multiple rows for better fallback detection
      const sampleRows = json.slice(1, 6);

      // Fallback: if no "name" detected, find the best text column by sampling data
      if (!guessed.includes("name")) {
        for (let i = 0; i < hdrs.length; i++) {
          if (guessed[i] !== "ignore") continue;
          const textCount = sampleRows.filter((row) => looksLikeText(String(row[i] || ""))).length;
          if (textCount >= Math.min(2, sampleRows.length)) {
            guessed[i] = "name";
            break;
          }
        }
      }

      // Fallback: if no "phone" detected, find best phone column by sampling data
      if (!guessed.includes("phone")) {
        for (let i = 0; i < hdrs.length; i++) {
          if (guessed[i] !== "ignore") continue;
          const phoneCount = sampleRows.filter((row) => looksLikePhone(String(row[i] || ""))).length;
          if (phoneCount >= Math.min(2, sampleRows.length)) {
            guessed[i] = "phone";
            break;
          }
        }
      }

      // Last resort: if STILL no name, check if header itself looks like a name (no header row)
      if (!guessed.includes("name")) {
        for (let i = 0; i < hdrs.length; i++) {
          if (guessed[i] !== "ignore") continue;
          if (looksLikeText(hdrs[i]) && !looksLikePhone(hdrs[i]) && !hdrs[i].includes("@")) {
            // First row might be data, not header — but we still map it
            guessed[i] = "name";
            break;
          }
        }
      }

      setMappings(guessed);

      // Store all rows for import
      (window as any).__importAllRows = json.slice(1);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleImport = async () => {
    if (!workspaceId || !user) return;
    const allRows: string[][] = (window as any).__importAllRows || [];
    if (!allRows.length) return;

    setImporting(true);

    const phoneIdx = mappings.indexOf("phone");
    if (phoneIdx === -1) {
      toast.error("Mapeie pelo menos a coluna de Telefone");
      setImporting(false);
      return;
    }

    const nameIdx = mappings.indexOf("name");
    const emailIdx = mappings.indexOf("email");
    const purchaseIdx = mappings.indexOf("last_purchase");

    const leads = allRows
      .map((row) => {
        const phone = normalizePhone(row[phoneIdx] || "");
        if (!phone) return null;
        const lastPurchase = purchaseIdx >= 0 ? parseDate(row[purchaseIdx]) : null;
        return {
          workspace_id: workspaceId,
          name: nameIdx >= 0 ? String(row[nameIdx] || "") : null,
          phone,
          email: emailIdx >= 0 ? String(row[emailIdx] || "") : null,
          last_purchase: lastPurchase,
          days_inactive: calcDaysInactive(lastPurchase),
          stage: "imported" as const,
        };
      })
      .filter(Boolean) as any[];

    const total = leads.length;
    let newLeads = 0;
    let duplicates = 0;
    let errorMsg: string | null = null;

    try {
      // Batch insert in chunks of 500
      const chunkSize = 500;
      for (let i = 0; i < leads.length; i += chunkSize) {
        const chunk = leads.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("leads")
          .upsert(chunk, { onConflict: "workspace_id,phone", ignoreDuplicates: true })
          .select("id");

        if (error) throw error;
        newLeads += data?.length || 0;
      }
      duplicates = total - newLeads;

      // Create import record
      await supabase.from("imports").insert({
        workspace_id: workspaceId,
        filename: fileName || "unknown.xlsx",
        total,
        new_leads: newLeads,
        duplicates,
        status: "success",
        created_by: user.id,
      });

      // Auto-mark eligible leads (90+ days inactive)
      const { count: eligibleCount } = await supabase
        .from("leads")
        .update({ stage: "eligible" })
        .eq("workspace_id", workspaceId)
        .eq("stage", "imported")
        .gte("days_inactive", 90)
        .eq("opt_out", false)
        .select("id", { count: "exact", head: true });

      const eligibleMsg = eligibleCount ? ` ${eligibleCount} marcados como elegíveis.` : "";
      toast.success(`Importação concluída: ${newLeads} novos, ${duplicates} duplicatas.${eligibleMsg}`);
      setFileName(null);
      setRawRows([]);
      setHeaders([]);
      setMappings([]);
      (window as any).__importAllRows = null;
    } catch (err: any) {
      errorMsg = err.message || "Erro desconhecido";
      toast.error(`Erro na importação: ${errorMsg}`);

      await supabase.from("imports").insert({
        workspace_id: workspaceId,
        filename: fileName || "unknown.xlsx",
        total,
        new_leads: newLeads,
        duplicates,
        status: "error",
        error_message: errorMsg,
        created_by: user.id,
      });
    } finally {
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["imports", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-leads"] });
    }
  };

  const cancelPreview = () => {
    setFileName(null);
    setRawRows([]);
    setHeaders([]);
    setMappings([]);
    (window as any).__importAllRows = null;
  };

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
        <h1 className="text-2xl font-semibold text-foreground">Importações</h1>
        <p className="text-sm text-muted-foreground">Upload e histórico de arquivos .xlsx</p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {fileName || "Arraste um arquivo .xlsx ou clique para selecionar"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Suporta .xlsx, .xls e .csv até 10MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview & Mapping */}
      {rawRows.length > 0 && (
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
                    {headers.map((h, i) => (
                      <TableHead key={i}>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">{h}</span>
                          <select
                            className="block w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={mappings[i] || "ignore"}
                            onChange={(e) => {
                              const next = [...mappings];
                              next[i] = e.target.value as FieldMapping;
                              setMappings(next);
                            }}
                          >
                            {FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                → {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawRows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j}>{String(cell ?? "")}</TableCell>
                      ))}
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
                <Button variant="outline" size="sm" onClick={cancelPreview} disabled={importing}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar {((window as any).__importAllRows || []).length} leads
                </Button>
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
              {importHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileSpreadsheet className="h-8 w-8" />
                      <p>Nenhuma importação ainda</p>
                      <p className="text-xs">Use a área de upload acima para importar sua primeira lista</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                importHistory.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-success" />
                        {imp.filename}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(imp.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{imp.total.toLocaleString()}</TableCell>
                    <TableCell className="text-success">{imp.new_leads.toLocaleString()}</TableCell>
                    <TableCell className="text-warning">{imp.duplicates.toLocaleString()}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Imports;
