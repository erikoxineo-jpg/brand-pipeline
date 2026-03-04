import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Lock,
  Headphones,
  HelpCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroBg from "@/assets/hero-bg.jpg";
import screenshotDashboard from "@/assets/screenshot-dashboard.png";
import screenshotLeads from "@/assets/screenshot-leads.png";
import screenshotPipeline from "@/assets/screenshot-pipeline.png";

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
    title: "Equipes & Permissões",
    description:
      "Gerencie múltiplas lojas ou marcas com controle de acesso por papel: Admin, Gestor e Operador. Cada marca com dados isolados.",
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
    name: "Dra. Fernanda Lima",
    role: "Diretora — Clínica Vitale",
    content:
      "Reativamos 23% dos pacientes inativos em apenas 2 semanas. Agendamentos pelo WhatsApp dispararam e o retorno foi imediato.",
    stars: 5,
  },
  {
    name: "Ricardo Santos",
    role: "Gerente — Boutique Essenza",
    content:
      "O pipeline Kanban é genial. Consigo ver exatamente em que etapa cada cliente está e meus operadores sabem exatamente o que fazer.",
    stars: 5,
  },
  {
    name: "Camila Rocha",
    role: "Proprietária — PetVida",
    content:
      "De 4.000 clientes inativos, recuperamos 340 em 30 dias. Vendas de rações e banho & tosa dispararam com as campanhas de reativação.",
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

  const handleCheckout = useCallback(async (planId: string, billingType = "PIX") => {
    setCheckoutLoading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = `/login?plan=${planId}`;
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planId, billingType },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: unknown) {
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
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
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
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground py-2 hover:text-foreground">FAQ</a>
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
          <p className="mt-6 text-center text-xs text-muted-foreground">
            * Dados baseados em benchmarks de mercado de campanhas WhatsApp Business no Brasil.
          </p>
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
            <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeScreenshot}
                  src={screenshots[activeScreenshot].src}
                  alt={screenshots[activeScreenshot].alt}
                  className="w-full"
                  loading="lazy"
                  width={1280}
                  height={720}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </AnimatePresence>
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
              Resultados reais em diferentes segmentos
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Veja como negócios diversos reconquistam clientes com o ReConnect.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid gap-6 md:grid-cols-3"
          >
            {[
              {
                brand: "Clínica Vitale",
                segment: "Estética & Saúde",
                metric: "23%",
                metricLabel: "de reativação",
                logo: "💆‍♀️",
                logoColor: "bg-sky-100 dark:bg-sky-900/30",
                messages: [
                  { from: "business", text: "Oi Ana! Sentimos sua falta na Clínica Vitale 💆‍♀️ Temos 20% OFF em limpeza de pele esta semana. Quer agendar?" },
                  { from: "client", text: "Oi! Que legal, faz tempo mesmo. Quero sim!" },
                  { from: "business", text: "Perfeito! Reservei quinta às 15h pra você. Te envio a confirmação por aqui 😊" },
                ],
              },
              {
                brand: "Boutique Essenza",
                segment: "Moda Feminina",
                metric: "340",
                metricLabel: "clientes em 30 dias",
                logo: "👗",
                logoColor: "bg-pink-100 dark:bg-pink-900/30",
                messages: [
                  { from: "business", text: "Oi Fernanda! A nova coleção de inverno chegou na Essenza 🧥 Como cliente especial, você tem acesso antecipado + frete grátis!" },
                  { from: "client", text: "Nossa, que chique! Tem casacos novos?" },
                  { from: "business", text: "Tem sim! Acabei de separar 3 opções no seu estilo. Mando as fotos?" },
                  { from: "client", text: "Manda!! Quero ver todos 😍" },
                ],
              },
              {
                brand: "PetVida",
                segment: "Pet Shop & Veterinária",
                metric: "R$18k",
                metricLabel: "recuperados no 1º mês",
                logo: "🐾",
                logoColor: "bg-amber-100 dark:bg-amber-900/30",
                messages: [
                  { from: "business", text: "Oi Carlos! O Rex está com a vacina V10 atrasada 🐕 Aqui na PetVida temos um combo: vacina + banho com 25% OFF!" },
                  { from: "client", text: "Eita, nem lembrava! Quanto fica?" },
                  { from: "business", text: "O combo sai R$89,90 em vez de R$120. Posso agendar pra sábado de manhã?" },
                  { from: "client", text: "Fecha! Sábado às 10h tá bom?" },
                ],
              },
            ].map((chat) => (
              <motion.div key={chat.brand} variants={fadeUp}>
                <Card className="flex h-full flex-col overflow-hidden border-border/50">
                  {/* Header */}
                  <div className="flex items-center gap-3 border-b border-border/50 bg-card px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chat.logoColor} text-lg`}>
                      {chat.logo}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{chat.brand}</p>
                      <p className="text-xs text-muted-foreground">{chat.segment}</p>
                    </div>
                  </div>
                  {/* Chat bubbles */}
                  <div className="flex flex-1 flex-col gap-2.5 bg-[#efeae2] dark:bg-[#0b141a] p-4">
                    {chat.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                          msg.from === "business"
                            ? "self-start rounded-tl-none bg-white dark:bg-[#202c33] text-foreground"
                            : "self-end rounded-tr-none bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                  </div>
                  {/* Result banner — suave */}
                  <div className="flex items-center justify-center gap-2 border-t border-border/50 bg-primary/10 px-5 py-2.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    <span className="text-base font-bold text-primary">{chat.metric}</span>
                    <span className="text-xs text-muted-foreground">{chat.metricLabel}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CAC Section — Video Background */}
      <section className="relative overflow-hidden py-28 sm:py-36">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          poster=""
        >
          <source src="/cac-bg.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/75" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center"
          >
            <motion.p variants={fadeUp} className="mb-4 text-sm font-medium uppercase tracking-widest text-primary-foreground/60">
              Você sabia?
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl"
            >
              Reativar clientes da sua base é{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                até 7x mais barato
              </span>{" "}
              que adquirir um novo
            </motion.h2>
            <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              Enquanto o CAC (Custo de Aquisição de Cliente) só aumenta, sua base de inativos é uma mina de ouro inexplorada. Com o ReConnect, você transforma clientes esquecidos em receita — sem gastar com anúncios.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="h-12 gap-2 px-8 text-base">
                  Começar Agora <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base">
                  Ver Planos
                </Button>
              </a>
            </motion.div>
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
                    plan: "Starter — 500 leads",
                    invest: "R$ 97/mês",
                    reactivated: "90 clientes",
                    example: "Uma clínica de estética com ticket médio de R$ 250 pode gerar R$ 22.500 em agendamentos reativados.",
                    roi: "232x o investimento",
                  },
                  {
                    plan: "Professional — 2.000 leads",
                    invest: "R$ 197/mês",
                    reactivated: "680 clientes",
                    example: "Uma loja de roupas com ticket médio de R$ 120 pode recuperar R$ 81.600 em vendas recorrentes.",
                    roi: "414x o investimento",
                    highlight: true,
                  },
                  {
                    plan: "Business — 10.000 leads",
                    invest: "R$ 397/mês",
                    reactivated: "3.400 clientes",
                    example: "Uma marca de cosméticos com ticket médio de R$ 80 pode faturar R$ 272.000 em vendas reativadas.",
                    roi: "685x o investimento",
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

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center"
          >
            <motion.div variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <HelpCircle className="h-4 w-4" />
              Dúvidas Frequentes
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground sm:text-4xl">
              Perguntas frequentes
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Tudo que você precisa saber antes de começar.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-12"
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="api">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Preciso ter WhatsApp Business API?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sim, o ReConnect se integra via API oficial do WhatsApp Business. Se você ainda não tem, podemos ajudar na configuração durante o onboarding.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="import">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Como funciona a importação de contatos?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Basta subir um arquivo Excel (.xlsx) com sua base de clientes. A plataforma normaliza automaticamente os telefones para o padrão internacional e remove duplicatas em segundos.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="limits">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Existe limite de disparos?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Não há limite de disparos em nenhum plano. O limite é de contatos na base ativa. Você pode enviar quantas campanhas quiser para os contatos do seu plano.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cancel">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Posso cancelar a qualquer momento?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sim, sem multa e sem burocracia. A mensalidade é cobrada mensalmente e pode ser cancelada quando quiser diretamente pelo painel.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="security">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Meus dados estão seguros?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sim. Utilizamos criptografia em trânsito e em repouso, servidores seguros com certificado SSL e estamos em conformidade com a LGPD. Seus dados e os de seus clientes estão protegidos.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="time">
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  Quanto tempo leva para começar?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Menos de 2 minutos. Crie sua conta, importe sua base de clientes e lance sua primeira campanha de reativação em poucos cliques.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-muted/30 py-20 sm:py-28">
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
              Assinatura mensal simples. Pague via PIX, Boleto ou Cartão.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                name: "Starter", planId: "starter", price: "R$97", highlight: false,
                leads: "500 leads", messages: "1.000 msgs/mês", users: "1 usuário",
                features: ["Dashboard completo", "Pipeline Kanban", "Importação de leads", "Suporte por e-mail"],
              },
              {
                name: "Professional", planId: "professional", price: "R$197", highlight: true,
                leads: "2.000 leads", messages: "5.000 msgs/mês", users: "3 usuários",
                features: ["Tudo do Starter", "Relatórios avançados", "Campanhas ilimitadas", "Suporte prioritário"],
              },
              {
                name: "Business", planId: "business", price: "R$397", highlight: false,
                leads: "10.000 leads", messages: "20.000 msgs/mês", users: "10 usuários",
                features: ["Tudo do Professional", "API completa", "Múltiplos workspaces", "Gerente de conta dedicado"],
              },
            ].map((plan) => (
              <motion.div key={plan.planId} variants={fadeUp}>
                <Card className={`relative h-full border-border/50 transition-shadow hover:shadow-lg ${plan.highlight ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Mais Popular
                    </div>
                  )}
                  <CardContent className="p-6">
                    <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                    <div className="mt-4 mb-1">
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    <div className="my-6 border-t border-border" />
                    <div className="space-y-2 text-sm text-muted-foreground mb-6">
                      <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {plan.leads}</p>
                      <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {plan.messages}</p>
                      <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {plan.users}</p>
                    </div>
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleCheckout(plan.planId)}
                      disabled={checkoutLoading === plan.planId}
                    >
                      {checkoutLoading === plan.planId ? "Aguarde..." : "Começar Agora"}
                    </Button>
                    <ul className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {f}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aceitamos PIX, Boleto e Cartão de Crédito. Cancele a qualquer momento.
          </p>
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
              Seus clientes inativos estão comprando do concorrente
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
              Recupere-os agora. Comece em 2 minutos — sem cartão de crédito para criar sua conta.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/login">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 gap-2 px-8 text-base font-semibold"
                >
                  Criar Conta Grátis <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 px-8 text-base text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Ver Planos
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Setup em 2 minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Disparos ilimitados</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Cancele quando quiser</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-y border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 gap-6 sm:grid-cols-4"
          >
            {[
              { icon: Shield, label: "LGPD Compliant", desc: "Em conformidade com a lei de proteção de dados" },
              { icon: Lock, label: "Dados Criptografados", desc: "SSL + criptografia em repouso" },
              { icon: MessageSquare, label: "API WhatsApp Oficial", desc: "Integração certificada pelo Meta" },
              { icon: Headphones, label: "Suporte Dedicado", desc: "Atendimento humano em todos os planos" },
            ].map((item) => (
              <motion.div key={item.label} variants={fadeUp} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Col 1 — Brand */}
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <MessageSquare className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground">ReConnect</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                CRM de reativação de clientes inativos via WhatsApp. Transforme clientes esquecidos em receita recorrente.
              </p>
            </div>
            {/* Col 2 — Produto */}
            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Produto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#screenshots" className="hover:text-foreground transition-colors">Plataforma</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Planos</a></li>
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">Depoimentos</a></li>
              </ul>
            </div>
            {/* Col 3 — Suporte */}
            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Suporte</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-foreground transition-colors">Perguntas Frequentes</a></li>
                <li><a href="mailto:contato@oxineo.com.br" className="hover:text-foreground transition-colors">contato@oxineo.com.br</a></li>
              </ul>
            </div>
            {/* Col 4 — Legal */}
            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Legal</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReConnect. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
