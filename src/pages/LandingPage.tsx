import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare,
  Users,
  BarChart3,
  Upload,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Star,
  TrendingUp,
  Clock,
  Target,
  DollarSign,
  Calculator,
  Menu,
  X,
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import screenshotDashboard from "@/assets/screenshot-dashboard.png";
import screenshotLeads from "@/assets/screenshot-leads.png";
import screenshotPipeline from "@/assets/screenshot-pipeline.png";
import whatsappModa from "@/assets/whatsapp-chat-moda.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

const stats = [
  { value: "34%", label: "Taxa média de reativação", icon: TrendingUp },
  { value: "3x", label: "Mais respostas que e-mail", icon: Zap },
  { value: "< 2min", label: "Para importar e disparar", icon: Clock },
  { value: "89%", label: "Taxa de abertura WhatsApp", icon: Target },
];

const features = [
  {
    icon: Upload,
    title: "Importação Inteligente",
    description:
      "Importe sua base de clientes inativos via Excel. Normalização automática de telefones no padrão E.164 e deduplicação em segundos.",
  },
  {
    icon: MessageSquare,
    title: "Disparos via WhatsApp",
    description:
      "Campanhas personalizadas com templates aprovados. Envio em massa com controle de velocidade e respeito ao opt-out.",
  },
  {
    icon: Users,
    title: "Pipeline Kanban",
    description:
      "Acompanhe cada lead pelo funil de reativação: Importado → Elegível → Contactado → Respondeu → Reativado.",
  },
  {
    icon: BarChart3,
    title: "Dashboard em Tempo Real",
    description:
      "KPIs de conversão, performance por operador, motivos de inatividade e funil completo em uma visão unificada.",
  },
  {
    icon: Shield,
    title: "Multi-tenant & RBAC",
    description:
      "Gerencie múltiplas marcas com controle de acesso por papel: Admin, Gestor e Operador. Dados isolados por brand.",
  },
  {
    icon: Zap,
    title: "Automação de Campanhas",
    description:
      "Crie campanhas com regras de elegibilidade, agendamento e acompanhamento automático de resultados.",
  },
];

const testimonials = [
  {
    name: "Marina Costa",
    role: "Gerente de Marketing — Glow Cosmetics",
    content:
      "Reativamos 23% da base inativa em apenas 2 semanas. Clientes voltaram comprando kits de skincare pelo WhatsApp. ROI absurdo!",
    stars: 5,
  },
  {
    name: "Carlos Mendes",
    role: "Diretor — Beleza Pura Cosméticos",
    content:
      "O pipeline Kanban é genial. Consigo ver exatamente em que etapa cada cliente está e meus operadores sabem exatamente o que fazer.",
    stars: 5,
  },
  {
    name: "Juliana Alves",
    role: "Head de Vendas — Essence Beauty",
    content:
      "De 4.000 clientes inativos, recuperamos 340 em 30 dias. Vendas de perfumes e maquiagens dispararam com as campanhas de reativação.",
    stars: 5,
  },
];

const screenshots = [
  { src: screenshotDashboard, alt: "Dashboard do ReConnect CRM com KPIs de reativação, funil de conversão e performance por operador", label: "Dashboard Analítico" },
  { src: screenshotLeads, alt: "Gestão de leads do ReConnect com tabela de clientes inativos, filtros e status de etapa", label: "Gestão de Leads" },
  { src: screenshotPipeline, alt: "Pipeline Kanban do ReConnect mostrando etapas de reativação de clientes", label: "Pipeline Kanban" },
];

const LandingPage = () => {
  const { session } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleCheckout = useCallback(async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login with return info
        window.location.href = `/login?plan=${planId}`;
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao iniciar pagamento. Tente novamente.");
      console.error(err);
    } finally {
      setCheckoutLoading(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ReConnect</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Funcionalidades</a>
            <a href="#screenshots" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Plataforma</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Planos</a>
            <a href="#testimonials" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Depoimentos</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (session) {
                  navigate(isMobile ? "/mobile-warning" : "/dashboard");
                } else {
                  navigate("/login");
                }
              }}
            >
              {session ? "Acessar Painel" : "Entrar"}
            </Button>
            <a href="#pricing">
              <Button size="sm" className="gap-1.5">
                Ver Planos <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border/50 bg-background px-4 py-4 md:hidden space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground py-2 hover:text-foreground">Funcionalidades</a>
            <a href="#screenshots" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground py-2 hover:text-foreground">Plataforma</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground py-2 hover:text-foreground">Planos</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground py-2 hover:text-foreground">Depoimentos</a>
            <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (session) {
                    navigate("/mobile-warning");
                  } else {
                    navigate("/login");
                  }
                }}
              >
                {session ? "Acessar Painel" : "Entrar"}
              </Button>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full gap-1.5">
                  Ver Planos <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Zap className="h-4 w-4" />
              CRM de Reativação via WhatsApp
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              Reative clientes inativos pelo{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                WhatsApp
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              Importe sua base, crie campanhas inteligentes e acompanhe cada reativação
              em tempo real. Transforme clientes esquecidos em receita recorrente.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="#pricing">
                <Button size="lg" className="h-12 gap-2 px-8 text-base">
                  Ver Planos — A partir de R$99/mês <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href="#screenshots">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                  Ver Plataforma
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 gap-8 lg:grid-cols-4"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="text-center">
                <stat.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Tudo que você precisa para reativar sua base
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Do import ao reativação, cada etapa otimizada para máxima conversão.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="h-full border-border/50 transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Conheça a plataforma por dentro
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Interface intuitiva, dados em tempo real e controle total sobre cada reativação.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-12"
          >
            <div className="mb-6 flex justify-center gap-2">
              {screenshots.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setActiveScreenshot(i)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeScreenshot === i
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <img
                src={screenshots[activeScreenshot].src}
                alt={screenshots[activeScreenshot].alt}
                className="w-full"
                loading="lazy"
                width={1280}
                height={720}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Como funciona
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              3 passos simples para começar a recuperar receita perdida.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid gap-8 sm:grid-cols-3"
          >
            {[
              { step: "01", title: "Importe sua base", desc: "Suba seu Excel com clientes inativos. A plataforma normaliza telefones e remove duplicatas automaticamente." },
              { step: "02", title: "Crie uma campanha", desc: "Defina critérios de elegibilidade, selecione um template WhatsApp e agende o disparo." },
              { step: "03", title: "Acompanhe resultados", desc: "Monitore respostas, avance leads no pipeline e veja suas reativações crescerem em tempo real." },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* WhatsApp Conversations Showcase */}
      <section className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Veja como suas marcas conversam no WhatsApp
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Mensagens personalizadas que geram respostas reais. Cada segmento com sua abordagem.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid gap-8 md:grid-cols-3"
          >
            {[
              {
                img: whatsappModa,
                brand: "Glow Cosmetics",
                segment: "Skincare & Cuidados com a Pele",
                result: "23% de reativação — clientes comprando kits de skincare pelo WhatsApp",
              },
              {
                img: whatsappModa,
                brand: "Beleza Pura",
                segment: "Loja de Maquiagens",
                result: "340 clientes recuperados em 30 dias com ofertas de nova coleção",
              },
              {
                img: whatsappModa,
                brand: "Essence Beauty",
                segment: "Perfumaria & Cosméticos",
                result: "R$47.000 em vendas de perfumes recuperadas no primeiro mês",
              },
            ].map((chat) => (
              <motion.div key={chat.brand} variants={fadeUp} className="text-center">
                <div className="mx-auto mb-6 w-64 overflow-hidden rounded-[2rem] border-4 border-border shadow-2xl">
                  <img src={chat.img} alt={`Conversa WhatsApp - ${chat.brand}`} className="w-full" loading="lazy" />
                </div>
                <div className="rounded-xl bg-card p-4 border border-border/50">
                  <p className="text-lg font-bold text-foreground">{chat.brand}</p>
                  <p className="text-sm text-muted-foreground">{chat.segment}</p>
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    {chat.result}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div variants={fadeUp}>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
                  <Calculator className="h-4 w-4" />
                  ROI Médio de 34%
                </div>
                <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                  Seu investimento se paga em <span className="text-primary">semanas</span>
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Com uma taxa média de reativação de 34%, o retorno sobre o investimento é rápido e previsível. Veja exemplos reais de quanto cada plano pode gerar:
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="space-y-4">
                {[
                  {
                    plan: "Plano 1.000 contatos",
                    invest: "R$ 699 + R$ 99/mês",
                    reactivated: "340 clientes",
                    example: "Uma loja de skincare com ticket médio de R$ 150 pode gerar R$ 51.000 em vendas de cosméticos reativadas.",
                    roi: "65x o investimento",
                  },
                  {
                    plan: "Plano 5.000 contatos",
                    invest: "R$ 1.299 + R$ 99/mês",
                    reactivated: "1.700 clientes",
                    example: "Uma marca de maquiagens com ticket médio de R$ 80 pode recuperar R$ 136.000 em vendas recorrentes.",
                    roi: "97x o investimento",
                    highlight: true,
                  },
                  {
                    plan: "Plano 10.000 contatos",
                    invest: "R$ 1.999 + R$ 99/mês",
                    reactivated: "3.400 clientes",
                    example: "Uma perfumaria com ticket médio de R$ 200 pode faturar R$ 680.000 em vendas de fragrâncias reativadas.",
                    roi: "324x o investimento",
                  },
                ].map((item) => (
                  <Card key={item.plan} className={`border-border/50 transition-shadow hover:shadow-lg ${item.highlight ? "border-primary ring-2 ring-primary/20" : ""}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{item.plan}</p>
                          <p className="text-xs text-muted-foreground">Investimento: {item.invest}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{item.example}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-primary">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm font-bold">{item.roi}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.reactivated} reativados</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <p className="text-center text-xs text-muted-foreground">
                  * Baseado na taxa média de reativação de 34% e tickets médios por segmento. Resultados podem variar.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="testimonials" className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Quem usa, recomenda
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Empresas de todos os tamanhos já estão recuperando clientes com o ReConnect.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-12 grid gap-6 sm:grid-cols-3"
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp}>
                <Card className="h-full border-border/50">
                  <CardContent className="p-6">
                    <div className="mb-3 flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">"{t.content}"</p>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Planos que cabem no seu negócio
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Mensalidade fixa + setup único por volume de contatos. Sem surpresas.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { contacts: "1.000", planId: "1000", setup: "R$699", monthly: "R$99", highlight: false },
              { contacts: "5.000", planId: "5000", setup: "R$1.299", monthly: "R$99", highlight: true },
              { contacts: "10.000", planId: "10000", setup: "R$1.999", monthly: "R$99", highlight: false },
              { contacts: "25.000", planId: "25000", setup: "R$2.499", monthly: "R$99", highlight: false },
            ].map((plan) => (
              <motion.div key={plan.contacts} variants={fadeUp}>
                <Card className={`relative h-full border-border/50 transition-shadow hover:shadow-lg ${plan.highlight ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Mais Popular
                    </div>
                  )}
                  <CardContent className="p-6 text-center">
                    <p className="text-sm font-medium text-muted-foreground">Até</p>
                    <p className="text-3xl font-bold text-foreground">{plan.contacts}</p>
                    <p className="text-sm text-muted-foreground">contatos</p>
                    <div className="my-6 border-t border-border" />
                    <div className="mb-1">
                      <span className="text-2xl font-bold text-foreground">{plan.monthly}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground">+ Setup único de {plan.setup}</p>
                    <Button
                      className="mt-6 w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleCheckout(plan.planId)}
                      disabled={checkoutLoading === plan.planId}
                    >
                      {checkoutLoading === plan.planId ? "Aguarde..." : "Começar Agora"}
                    </Button>
                    <ul className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Disparos ilimitados</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Dashboard completo</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Pipeline Kanban</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Suporte dedicado</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="rounded-2xl bg-primary px-8 py-16 text-center sm:px-16"
          >
            <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
              Comece a reativar clientes hoje
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
              A partir de R$99/mês. Setup rápido e suporte dedicado para sua operação.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="#pricing">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 gap-2 px-8 text-base font-semibold"
                >
                  Ver Planos <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Setup em 2 minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Disparos ilimitados</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Suporte dedicado</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">ReConnect</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReConnect. CRM de reativação via WhatsApp.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
