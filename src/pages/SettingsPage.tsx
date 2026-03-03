import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Plus, Pencil, Trash2 } from "lucide-react";

const users = [
  { id: 1, name: "Admin Principal", email: "admin@marca.com", role: "Admin" },
  { id: 2, name: "Ana Costa", email: "ana@marca.com", role: "Gestor" },
  { id: 3, name: "Carlos Lima", email: "carlos@marca.com", role: "Operador" },
  { id: 4, name: "Maria Santos", email: "maria@marca.com", role: "Operador" },
];

const roleColors: Record<string, string> = {
  Admin: "bg-destructive/10 text-destructive",
  Gestor: "bg-primary/10 text-primary",
  Operador: "bg-secondary text-secondary-foreground",
};

const SettingsPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie a marca e usuários</p>
      </div>

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand" className="gap-2">
            <Building2 className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Marca</CardTitle>
              <CardDescription>Informações visíveis para leads e campanhas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Marca</Label>
                  <Input defaultValue="Marca Demo" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone WhatsApp</Label>
                  <Input defaultValue="+5511999000000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias de inatividade (para elegibilidade)</Label>
                <Input type="number" defaultValue="90" />
                <p className="text-xs text-muted-foreground">
                  Leads sem compra há mais de X dias serão marcados como elegíveis
                </p>
              </div>
              <div className="space-y-2">
                <Label>Palavras-chave de Opt-out</Label>
                <Input defaultValue="parar, sair, cancelar, remover, stop" />
                <p className="text-xs text-muted-foreground">
                  Separadas por vírgula. Bloqueiam novos disparos automaticamente.
                </p>
              </div>
              <Button size="sm">Salvar Alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Usuários</CardTitle>
                  <CardDescription>Gerencie os membros da equipe</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Convidar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={roleColors[user.role] || ""}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
