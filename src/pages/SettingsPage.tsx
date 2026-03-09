import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Users, Plus, Pencil, Trash2, Loader2, Wifi, CreditCard, ExternalLink, QrCode, Code, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
};

const roleColors: Record<string, string> = {
  owner: "bg-destructive/10 text-destructive",
  admin: "bg-primary/10 text-primary",
  member: "bg-secondary text-secondary-foreground",
};

const planLabels: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  business: "Business",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "bg-green-500/10 text-green-600" },
  overdue: { label: "Atrasada", color: "bg-yellow-500/10 text-yellow-600" },
  canceled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
  trial: { label: "Trial", color: "bg-blue-500/10 text-blue-600" },
};

const SettingsPage = () => {
  const { currentWorkspace, user, subscription } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Brand form state
  const [brandName, setBrandName] = useState("");

  // WhatsApp config state
  const [waProvider, setWaProvider] = useState<"evolution" | "meta">("evolution");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waWabaId, setWaWabaId] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waVerifyToken, setWaVerifyToken] = useState("");

  // Evolution API state
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("");
  const [evolutionStatus, setEvolutionStatus] = useState("close");
  const [evolutionPhone, setEvolutionPhone] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  // Edit role dialog
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("member");

  // Load workspace data
  useEffect(() => {
    if (currentWorkspace) {
      setBrandName(currentWorkspace.name);
    }
  }, [currentWorkspace]);

  // Load WhatsApp config
  const { data: waConfig } = useQuery({
    queryKey: ["whatsapp-config", workspaceId],
    queryFn: () => apiFetch<any>("/whatsapp/config").catch(() => null),
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (waConfig) {
      setWaPhoneNumberId(waConfig.phone_number_id || "");
      setWaWabaId(waConfig.waba_id || "");
      setWaAccessToken(waConfig.access_token || "");
      setWaVerifyToken(waConfig.verify_token || "");
      setWaProvider((waConfig.provider as "evolution" | "meta") || "evolution");
      setEvolutionInstanceName(waConfig.evolution_instance_name || "");
      setEvolutionStatus(waConfig.evolution_status || "close");
      setEvolutionPhone(waConfig.evolution_phone || "");
    }
  }, [waConfig]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Evolution API helpers
  const EVOLUTION_BASE = "/api/evolution";

  const generateInstanceName = useCallback(() => {
    if (!workspaceId) return "";
    return `rc_${workspaceId.replace(/-/g, "").slice(0, 12)}`;
  }, [workspaceId]);

  const safeJson = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  };

  const connectEvolution = async () => {
    if (!workspaceId) return;
    setIsConnecting(true);
    setQrCode(null);

    const instanceName = generateInstanceName();
    setEvolutionInstanceName(instanceName);

    try {
      // Check if instance already exists and is connected
      const checkRes = await fetch(`${EVOLUTION_BASE}/instance/connectionState/${instanceName}`);
      const checkData = await safeJson(checkRes);
      if (checkRes.ok && checkData) {
        const state = checkData.instance?.state || checkData.state;
        if (state === "open") {
          // Already connected — just save config
          setEvolutionStatus("open");
          setIsConnecting(false);

          const infoRes = await fetch(`${EVOLUTION_BASE}/instance/fetchInstances?instanceName=${instanceName}`);
          const infoData = await safeJson(infoRes);
          const phone = infoData?.[0]?.ownerJid || "";
          setEvolutionPhone(phone);

          await saveEvolutionConfig(instanceName, "open", phone);
          toast.success("WhatsApp já estava conectado!");
          return;
        }

        // Instance exists but disconnected — try to get QR code via /connect
        const connectRes = await fetch(`${EVOLUTION_BASE}/instance/connect/${instanceName}`);
        const connectData = await safeJson(connectRes);
        if (connectRes.ok && connectData?.base64) {
          setQrCode(connectData.base64);
          startPolling(instanceName);
          return;
        }
      }

      // Instance doesn't exist — delete any leftover and create fresh
      await fetch(`${EVOLUTION_BASE}/instance/delete/${instanceName}`, { method: "DELETE" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));

      const createRes = await fetch(`${EVOLUTION_BASE}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      const createData = await safeJson(createRes);

      if (createData?.qrcode?.base64) {
        setQrCode(createData.qrcode.base64);
      } else if (createData?.instance?.status === "open") {
        setEvolutionStatus("open");
        setIsConnecting(false);
        await saveEvolutionConfig(instanceName, "open", createData.instance?.owner || "");
        return;
      } else {
        await new Promise((r) => setTimeout(r, 2000));
        const retryRes = await fetch(`${EVOLUTION_BASE}/instance/connect/${instanceName}`);
        const retryData = await safeJson(retryRes);
        if (retryData?.base64) {
          setQrCode(retryData.base64);
        }
      }

      startPolling(instanceName);
    } catch (err: any) {
      toast.error("Erro ao conectar: " + err.message);
      setIsConnecting(false);
    }
  };

  const startPolling = (instanceName: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    let attempts = 0;
    const maxAttempts = 20; // ~60s timeout (20 * 3s)

    pollingRef.current = setInterval(async () => {
      attempts++;

      // Timeout — stop polling and let user retry
      if (attempts >= maxAttempts) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setQrCode(null);
        setIsConnecting(false);
        toast.error("QR code expirou. Clique em 'Conectar WhatsApp' para tentar novamente.");
        return;
      }

      try {
        const res = await fetch(`${EVOLUTION_BASE}/instance/connectionState/${instanceName}`);
        const data = await res.json();
        const state = data.instance?.state || data.state;

        if (state === "open") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setEvolutionStatus("open");
          setQrCode(null);
          setIsConnecting(false);

          // Fetch instance info to get phone number
          const infoRes = await fetch(`${EVOLUTION_BASE}/instance/fetchInstances?instanceName=${instanceName}`);
          const infoData = await infoRes.json();
          const phone = infoData?.[0]?.ownerJid || infoData?.[0]?.instance?.owner || "";
          setEvolutionPhone(phone);

          await saveEvolutionConfig(instanceName, "open", phone);
          toast.success("WhatsApp conectado!");
        }
      } catch {
        // Silently retry
      }
    }, 3000);
  };

  const saveEvolutionConfig = async (instanceName: string, status: string, phone: string) => {
    if (!workspaceId) return;
    try {
      await apiFetch("/whatsapp/config", {
        method: "PUT",
        body: JSON.stringify({
          provider: "evolution",
          evolution_instance_name: instanceName,
          evolution_status: status,
          evolution_phone: phone,
        }),
      });
    } catch (err: any) {
      console.error("Error saving evolution config:", err);
    }
    queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
  };

  const disconnectEvolution = async () => {
    if (!evolutionInstanceName) return;
    try {
      await fetch(`${EVOLUTION_BASE}/instance/logout/${evolutionInstanceName}`, { method: "DELETE" });
      setEvolutionStatus("close");
      setEvolutionPhone("");
      setQrCode(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      await saveEvolutionConfig(evolutionInstanceName, "close", "");
      toast.success("WhatsApp desconectado");
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + err.message);
    }
  };

  const reconnectEvolution = async () => {
    if (!evolutionInstanceName) return;
    setIsConnecting(true);
    setQrCode(null);
    try {
      const res = await fetch(`${EVOLUTION_BASE}/instance/connect/${evolutionInstanceName}`);
      const data = await res.json();
      if (data.base64) {
        setQrCode(data.base64);
        setEvolutionStatus("close");
        startPolling(evolutionInstanceName);
      } else {
        setIsConnecting(false);
        toast.info("Instância já conectada ou erro ao reconectar");
      }
    } catch (err: any) {
      setIsConnecting(false);
      toast.error("Erro ao reconectar: " + err.message);
    }
  };

  // Load workspace members
  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => {
      if (!workspaceId) return [];
      return apiFetch<any[]>(`/workspaces/${workspaceId}/members`);
    },
    enabled: !!workspaceId,
  });

  // Load payments history
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", workspaceId],
    queryFn: () => apiFetch<any[]>("/payments").catch(() => []),
    enabled: !!workspaceId,
  });

  // Save brand settings
  const saveBrandMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await apiFetch(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: brandName }),
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Save WhatsApp config (Meta Cloud API)
  const saveWhatsAppMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await apiFetch("/whatsapp/config", {
        method: "PUT",
        body: JSON.stringify({
          provider: "meta",
          phone_number_id: waPhoneNumberId || null,
          waba_id: waWabaId || null,
          access_token: waAccessToken || null,
          verify_token: waVerifyToken || null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("WhatsApp configurado");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Invite member
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await apiFetch(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
    },
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Membro adicionado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      if (!workspaceId) throw new Error("No workspace");
      await apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      setEditMemberId(null);
      toast.success("Papel atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!workspaceId) throw new Error("No workspace");
      await apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Membro removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

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
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie o workspace e usuários</p>
      </div>

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand" className="gap-2">
            <Building2 className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Wifi className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
        </TabsList>

        {/* Brand Tab */}
        <TabsContent value="brand" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do Workspace</CardTitle>
              <CardDescription>Informações visíveis para leads e campanhas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Workspace</Label>
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => saveBrandMutation.mutate()}
                disabled={saveBrandMutation.isPending}
              >
                {saveBrandMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4 pt-4">
          <Tabs defaultValue="qrcode">
            <TabsList className="mb-4">
              <TabsTrigger value="qrcode" className="gap-2">
                <QrCode className="h-4 w-4" />
                QR Code (Recomendado)
              </TabsTrigger>
              <TabsTrigger value="meta-api" className="gap-2">
                <Code className="h-4 w-4" />
                API Oficial (Avançado)
              </TabsTrigger>
            </TabsList>

            {/* QR Code / Evolution API sub-tab */}
            <TabsContent value="qrcode">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conectar WhatsApp via QR Code</CardTitle>
                  <CardDescription>
                    Escaneie o QR code com seu WhatsApp para conectar. Sem configuração técnica.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {evolutionStatus === "open" && waProvider === "evolution" ? (
                    /* Connected state */
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800 dark:text-green-200">WhatsApp Conectado</p>
                          {evolutionPhone && (
                            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 mt-0.5">
                              <Smartphone className="h-3.5 w-3.5" />
                              {evolutionPhone}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-green-600 text-white">Ativo</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectEvolution}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Desconectar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={reconnectEvolution}
                          disabled={isConnecting}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${isConnecting ? "animate-spin" : ""}`} />
                          Reconectar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Disconnected state */
                    <div className="space-y-4">
                      {!qrCode && !isConnecting && (
                        <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8">
                          <div className="rounded-full bg-muted p-4">
                            <QrCode className="h-10 w-10 text-muted-foreground" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium">WhatsApp não conectado</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Clique abaixo para gerar um QR code e conectar seu WhatsApp
                            </p>
                          </div>
                          <Button onClick={connectEvolution}>
                            <Smartphone className="mr-2 h-4 w-4" />
                            Conectar WhatsApp
                          </Button>
                        </div>
                      )}

                      {(qrCode || isConnecting) && (
                        <div className="flex flex-col items-center gap-4 py-4">
                          {qrCode ? (
                            <>
                              <p className="text-sm font-medium">Escaneie o QR code com seu WhatsApp</p>
                              <div className="rounded-lg border p-2 bg-white">
                                <img
                                  src={qrCode}
                                  alt="QR Code WhatsApp"
                                  width={264}
                                  height={264}
                                  className="block"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
                              </p>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Gerando QR code...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meta Cloud API sub-tab */}
            <TabsContent value="meta-api">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">WhatsApp Cloud API (Meta)</CardTitle>
                  <CardDescription>
                    Integração via API oficial do Meta Business Platform
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <p className="font-medium">Configuração avançada</p>
                      <p className="mt-1">
                        Requer conta Meta Business verificada, app no Meta Developers e número de telefone
                        dedicado. Para a maioria dos usuários, recomendamos usar a conexão via QR Code.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={waPhoneNumberId}
                        onChange={(e) => setWaPhoneNumberId(e.target.value)}
                        placeholder="Ex: 123456789012345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WABA ID</Label>
                      <Input
                        value={waWabaId}
                        onChange={(e) => setWaWabaId(e.target.value)}
                        placeholder="WhatsApp Business Account ID"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type="password"
                      value={waAccessToken}
                      onChange={(e) => setWaAccessToken(e.target.value)}
                      placeholder="Token permanente do WhatsApp Business"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Verify Token (para webhook)</Label>
                    <Input
                      value={waVerifyToken}
                      onChange={(e) => setWaVerifyToken(e.target.value)}
                      placeholder="Token customizado para verificação do webhook"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL do webhook: {`${window.location.origin}/api/webhooks/whatsapp`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveWhatsAppMutation.mutate()}
                    disabled={saveWhatsAppMutation.isPending}
                  >
                    {saveWhatsAppMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configuração Meta API
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plano Atual</CardTitle>
              <CardDescription>Informações sobre sua assinatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {planLabels[subscription.plan] || subscription.plan}
                  </p>
                  {subscription.status && (
                    <Badge variant="secondary" className={statusLabels[subscription.status]?.color || ""}>
                      {statusLabels[subscription.status]?.label || subscription.status}
                    </Badge>
                  )}
                  {!subscription.status && (
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                      Sem assinatura
                    </Badge>
                  )}
                </div>
              </div>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  Próxima cobrança: {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
                </p>
              )}
              <div className="grid grid-cols-3 gap-4 rounded-lg border p-4">
                <div className="text-center">
                  <p className="text-lg font-semibold">{subscription.limits.maxLeads.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{subscription.limits.maxMessages.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground">Msgs/mês</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{subscription.limits.maxUsers}</p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
              {subscription.plan === "free" && (
                <Button size="sm" onClick={() => window.location.href = "/#pricing"}>
                  Fazer Upgrade
                </Button>
              )}
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Pagamentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">
                          R$ {Number(payment.amount).toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={
                            payment.status === "confirmed" ? "bg-green-500/10 text-green-600" :
                            payment.status === "overdue" ? "bg-yellow-500/10 text-yellow-600" :
                            payment.status === "refunded" ? "bg-destructive/10 text-destructive" :
                            "bg-secondary text-secondary-foreground"
                          }>
                            {payment.status === "confirmed" ? "Pago" :
                             payment.status === "overdue" ? "Atrasado" :
                             payment.status === "refunded" ? "Estornado" :
                             "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {payment.billing_type || "-"}
                        </TableCell>
                        <TableCell>
                          {payment.invoice_url && (
                            <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Usuários</CardTitle>
                  <CardDescription>Gerencie os membros do workspace</CardDescription>
                </div>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Convidar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Convidar Membro</DialogTitle>
                      <DialogDescription>
                        O usuário precisa ter uma conta no ReConnect
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input
                          placeholder="usuario@empresa.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Papel</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as any)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Membro</option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => inviteMutation.mutate()}
                        disabled={!inviteEmail || inviteMutation.isPending}
                      >
                        Convidar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.display_name || "Sem nome"}
                      </TableCell>
                      <TableCell>
                        {editMemberId === member.id ? (
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={editRole}
                            autoFocus
                            onChange={(e) => {
                              setEditRole(e.target.value);
                              updateRoleMutation.mutate({ memberId: member.id, role: e.target.value });
                            }}
                            onBlur={() => setEditMemberId(null)}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Membro</option>
                          </select>
                        ) : (
                          <Badge variant="secondary" className={roleColors[member.role] || ""}>
                            {roleLabels[member.role] || member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {member.user_id !== user?.id && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditMemberId(member.id);
                                setEditRole(member.role);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (confirm("Remover este membro?")) {
                                  removeMemberMutation.mutate(member.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
