import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const planFromUrl = searchParams.get("plan");

  if (user) {
    return <Navigate to={planFromUrl ? `/?autoCheckout=${planFromUrl}` : "/dashboard"} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
      navigate(planFromUrl ? `/?autoCheckout=${planFromUrl}` : "/dashboard");
    } catch (error: any) {
      const raw = error?.message || "";
      const msg = raw === "Invalid login credentials" || raw.includes("Invalid")
        ? "E-mail ou senha incorretos."
        : raw.includes("Email not confirmed")
        ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
        : raw;
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      // API signup auto-logs in — redirect straight to dashboard
      toast({ title: "Conta criada!", description: "Bem-vindo ao ReConnect." });
      navigate(planFromUrl ? `/?autoCheckout=${planFromUrl}` : "/dashboard");
    } catch (error: any) {
      const raw = error?.message || "";
      const msg = raw.includes("already registered") || raw.includes("already exists")
        ? "Este e-mail já está cadastrado. Tente fazer login."
        : raw;
      toast({ title: "Erro ao cadastrar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">ReConnect</h1>
            <p className="text-sm text-muted-foreground">CRM de reativação via WhatsApp</p>
          </div>
        </div>

        {signUpSuccess ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Verifique seu e-mail</h2>
                  <p className="text-sm text-muted-foreground">
                    Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clique no link do e-mail para ativar sua conta. Verifique também a pasta de spam.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span>Após confirmar, volte aqui e faça login.</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSignUpSuccess(false)}
                >
                  Voltar para o login
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Entrar</CardTitle>
                  <CardDescription>Acesse sua conta para continuar</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-mail</Label>
                      <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>

              <TabsContent value="signup">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Criar Conta</CardTitle>
                  <CardDescription>Crie sua conta para começar</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome</Label>
                      <Input id="signup-name" placeholder="Seu nome" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-mail</Label>
                      <Input id="signup-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input id="signup-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Criando..." : "Criar Conta"}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Login;
