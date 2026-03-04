import { useState, useEffect } from "react";
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
import { Building2, Users, Plus, Pencil, Trash2, Loader2, Wifi } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

const SettingsPage = () => {
  const { currentWorkspace, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Brand form state
  const [brandName, setBrandName] = useState("");

  // WhatsApp config state
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waWabaId, setWaWabaId] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waVerifyToken, setWaVerifyToken] = useState("");

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
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (waConfig) {
      setWaPhoneNumberId(waConfig.phone_number_id || "");
      setWaWabaId(waConfig.waba_id || "");
      setWaAccessToken(waConfig.access_token || "");
      setWaVerifyToken(waConfig.verify_token || "");
    }
  }, [waConfig]);

  // Load workspace members
  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", workspaceId);
      if (error) throw error;

      // Fetch profiles for members
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      for (const p of profiles || []) {
        profileMap[p.user_id] = p;
      }

      return data.map((m) => ({
        ...m,
        profile: profileMap[m.user_id] || {},
      }));
    },
    enabled: !!workspaceId,
  });

  // Save brand settings
  const saveBrandMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      const { error } = await supabase
        .from("workspaces")
        .update({ name: brandName })
        .eq("id", workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Save WhatsApp config
  const saveWhatsAppMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      const configData = {
        workspace_id: workspaceId,
        phone_number_id: waPhoneNumberId || null,
        waba_id: waWabaId || null,
        access_token: waAccessToken || null,
        verify_token: waVerifyToken || null,
      };

      const { error } = await supabase
        .from("whatsapp_config")
        .upsert(configData, { onConflict: "workspace_id" });
      if (error) throw error;
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

      // Look up user by email in auth (we need their user_id)
      // Since we can't query auth.users from client, we check profiles
      // The user must already exist in the system
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(100);

      if (profileErr) throw profileErr;

      // We need to find by email which is in auth.users - not directly accessible from client
      // Workaround: just inform the user the invited person must already have an account
      toast.info("O usuário precisa ter uma conta. Adicione pelo user_id ou peça que crie uma conta primeiro.");
      throw new Error("Convite por email ainda não suportado. Use user_id diretamente.");
    },
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Membro adicionado");
    },
    onError: (err: any) => {
      if (!err.message.includes("ainda não suportado")) {
        toast.error(err.message);
      }
    },
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
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
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp Cloud API</CardTitle>
              <CardDescription>
                Configure a integração com a API do WhatsApp Business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  URL do webhook: {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => saveWhatsAppMutation.mutate()}
                disabled={saveWhatsAppMutation.isPending}
              >
                {saveWhatsAppMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configuração WhatsApp
              </Button>
            </CardContent>
          </Card>
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
                        {member.profile?.display_name || "Sem nome"}
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
