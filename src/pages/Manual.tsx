import { useState, useEffect } from "react";
import {
  BookOpen,
  Rocket,
  Upload,
  Users,
  Megaphone,
  Kanban,
  MessageSquare,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronRight,
  ArrowUp,
} from "lucide-react";

const sections = [
  { id: "bem-vindo", title: "Bem-vindo ao ReConnect", icon: BookOpen },
  { id: "primeiros-passos", title: "Primeiros Passos", icon: Rocket },
  { id: "importar-leads", title: "Importar Leads", icon: Upload },
  { id: "gerenciar-leads", title: "Gerenciar Leads", icon: Users },
  { id: "criar-campanhas", title: "Criar Campanhas", icon: Megaphone },
  { id: "pipeline", title: "Pipeline (Kanban)", icon: Kanban },
  { id: "disparos", title: "Disparos WhatsApp", icon: MessageSquare },
  { id: "dashboard", title: "Dashboard", icon: BarChart3 },
  { id: "configuracoes", title: "Configurações", icon: Settings },
  { id: "duvidas", title: "Dúvidas Frequentes", icon: HelpCircle },
];

const Manual = () => {
  const [activeSection, setActiveSection] = useState("bem-vindo");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex h-full">
      {/* Sidebar / Table of Contents */}
      <nav className="hidden lg:flex w-64 flex-col border-r border-border bg-card/50 p-4 overflow-y-auto sticky top-0 h-screen">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
          Índice
        </h2>
        <div className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === s.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Manual de Operação
          </h1>
          <p className="text-muted-foreground mt-2">
            Guia completo para usar o ReConnect CRM. Clique no índice ao lado para navegar.
          </p>
        </div>

        {/* Mobile TOC */}
        <div className="lg:hidden mb-8 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Índice
          </h2>
          <div className="grid grid-cols-2 gap-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-12">
          {/* 1. Bem-vindo */}
          <section id="bem-vindo" className="scroll-mt-6">
            <SectionTitle icon={BookOpen} title="Bem-vindo ao ReConnect" />
            <div className="prose-content">
              <p>
                O <strong>ReConnect</strong> é uma plataforma de CRM focada em recuperar clientes inativos
                através do WhatsApp. Com ele, você importa sua base de clientes, cria campanhas personalizadas
                e envia mensagens em massa de forma organizada.
              </p>
              <p>
                O sistema foi pensado para ser simples: você importa seus leads, monta a mensagem,
                dispara pelo WhatsApp e acompanha os resultados em tempo real pelo Dashboard.
              </p>
              <Highlight>
                Objetivo principal: trazer de volta clientes que pararam de comprar, usando comunicação
                personalizada e direta pelo WhatsApp.
              </Highlight>
            </div>
          </section>

          {/* 2. Primeiros Passos */}
          <section id="primeiros-passos" className="scroll-mt-6">
            <SectionTitle icon={Rocket} title="Primeiros Passos" />
            <div className="prose-content">
              <h4>1. Fazer login</h4>
              <p>
                Acesse o sistema pelo link fornecido e entre com seu e-mail e senha.
                Se é seu primeiro acesso, peça ao administrador para criar sua conta.
              </p>

              <h4>2. Workspace</h4>
              <p>
                Ao entrar, você estará dentro do <strong>workspace</strong> da sua empresa.
                O workspace é o espaço onde ficam todos os leads, campanhas e configurações do seu negócio.
              </p>

              <h4>3. Navegação</h4>
              <p>
                Use o menu lateral (sidebar) para navegar entre as páginas. Cada ícone
                representa uma área do sistema:
              </p>
              <ul>
                <li><strong>Dashboard</strong> — Visão geral com números e gráficos</li>
                <li><strong>Leads</strong> — Lista completa dos seus contatos</li>
                <li><strong>Importar</strong> — Enviar planilha com novos leads</li>
                <li><strong>Campanhas</strong> — Criar e gerenciar campanhas</li>
                <li><strong>Pipeline</strong> — Quadro visual (Kanban) dos leads</li>
                <li><strong>Disparos</strong> — Enviar e acompanhar mensagens WhatsApp</li>
                <li><strong>Configurações</strong> — Ajustes do workspace e equipe</li>
              </ul>
            </div>
          </section>

          {/* 3. Importar Leads */}
          <section id="importar-leads" className="scroll-mt-6">
            <SectionTitle icon={Upload} title="Importar Leads" />
            <div className="prose-content">
              <h4>Formato da planilha</h4>
              <p>
                Prepare um arquivo <strong>Excel (.xlsx)</strong> com as seguintes colunas:
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Coluna</th>
                      <th className="px-4 py-2 text-left font-medium">Obrigatória</th>
                      <th className="px-4 py-2 text-left font-medium">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 font-medium">Nome</td>
                      <td className="px-4 py-2">Sim</td>
                      <td className="px-4 py-2">Maria Silva</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 font-medium">Telefone</td>
                      <td className="px-4 py-2">Sim</td>
                      <td className="px-4 py-2">(11) 99999-1234</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 font-medium">Email</td>
                      <td className="px-4 py-2">Não</td>
                      <td className="px-4 py-2">maria@email.com</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 font-medium">Última Compra</td>
                      <td className="px-4 py-2">Não</td>
                      <td className="px-4 py-2">2025-01-15</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4>Como importar</h4>
              <ol>
                <li>Vá até a página <strong>Importar</strong> no menu lateral</li>
                <li>Clique em <strong>"Selecionar arquivo"</strong> e escolha sua planilha</li>
                <li>O sistema vai mostrar as colunas encontradas — faça o <strong>mapeamento</strong> (diga qual coluna da planilha corresponde a Nome, Telefone, etc.)</li>
                <li>Clique em <strong>"Importar"</strong></li>
              </ol>

              <Highlight>
                O telefone será normalizado automaticamente para o formato internacional (ex: 5511999991234).
                Não se preocupe com formatação — o sistema cuida disso.
              </Highlight>
            </div>
          </section>

          {/* 4. Gerenciar Leads */}
          <section id="gerenciar-leads" className="scroll-mt-6">
            <SectionTitle icon={Users} title="Gerenciar Leads" />
            <div className="prose-content">
              <p>
                A página <strong>Leads</strong> mostra todos os contatos importados. Aqui você pode:
              </p>

              <h4>Buscar e filtrar</h4>
              <p>
                Use a barra de busca para encontrar leads por nome ou telefone.
                Filtre por etapa do funil (novo, contactado, interessado, etc.) clicando nos filtros.
              </p>

              <h4>Editar etapa do lead</h4>
              <p>
                Clique no <strong>badge colorido</strong> ao lado do nome do lead para mudar sua etapa
                no funil. Por exemplo, mover de "Novo" para "Contactado" após uma conversa.
              </p>

              <h4>Exportar para CSV</h4>
              <p>
                Use o botão de exportação para baixar sua lista de leads em formato CSV,
                que pode ser aberto no Excel.
              </p>

              <h4>Marcar opt-out</h4>
              <p>
                Se um cliente pediu para não receber mais mensagens, marque-o como <strong>opt-out</strong>.
                Leads com opt-out não recebem disparos de campanhas.
              </p>
            </div>
          </section>

          {/* 5. Criar Campanhas */}
          <section id="criar-campanhas" className="scroll-mt-6">
            <SectionTitle icon={Megaphone} title="Criar Campanhas" />
            <div className="prose-content">
              <h4>Nova campanha</h4>
              <ol>
                <li>Vá até <strong>Campanhas</strong> no menu lateral</li>
                <li>Clique em <strong>"Nova Campanha"</strong></li>
                <li>Dê um nome para a campanha (ex: "Recuperação Janeiro")</li>
                <li>Escreva a mensagem que será enviada</li>
              </ol>

              <h4>Variáveis na mensagem</h4>
              <p>
                Você pode personalizar a mensagem usando variáveis entre chaves duplas.
                O sistema substitui automaticamente pelos dados do lead:
              </p>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                <p>Olá {"{{nome}}"}, tudo bem? 😊</p>
                <p>Faz {"{{dias}}"} dias que não te vemos por aqui na {"{{marca}}"}!</p>
                <p>Preparamos algo especial pra você...</p>
              </div>

              <h4>Tipos de campanha</h4>
              <ul>
                <li><strong>Pesquisa</strong> — Perguntar ao cliente o motivo da ausência</li>
                <li><strong>Oferta</strong> — Enviar uma promoção ou cupom de desconto</li>
              </ul>

              <Highlight>
                Dica: mensagens curtas e diretas funcionam melhor. Inclua sempre o nome do cliente
                para uma abordagem mais pessoal.
              </Highlight>
            </div>
          </section>

          {/* 6. Pipeline */}
          <section id="pipeline" className="scroll-mt-6">
            <SectionTitle icon={Kanban} title="Pipeline (Kanban)" />
            <div className="prose-content">
              <p>
                O Pipeline é um quadro visual onde você vê seus leads organizados em colunas,
                representando cada etapa do processo de recuperação.
              </p>

              <h4>Etapas do funil</h4>
              <ul>
                <li><strong>Novo</strong> — Lead recém-importado, ainda não contactado</li>
                <li><strong>Contactado</strong> — Mensagem enviada, aguardando resposta</li>
                <li><strong>Interessado</strong> — Cliente respondeu com interesse</li>
                <li><strong>Agendado</strong> — Visita ou compra agendada</li>
                <li><strong>Convertido</strong> — Cliente voltou a comprar</li>
                <li><strong>Perdido</strong> — Cliente não tem interesse</li>
              </ul>

              <h4>Como usar</h4>
              <p>
                <strong>Arraste e solte</strong> os cartões de lead entre as colunas para atualizar
                a etapa. O sistema salva automaticamente a mudança.
              </p>

              <Highlight>
                O Pipeline é a melhor forma de ter uma visão geral de como está sua campanha
                de recuperação. Verifique diariamente para mover leads que responderam.
              </Highlight>
            </div>
          </section>

          {/* 7. Disparos WhatsApp */}
          <section id="disparos" className="scroll-mt-6">
            <SectionTitle icon={MessageSquare} title="Disparos WhatsApp" />
            <div className="prose-content">
              <h4>Enviar mensagens</h4>
              <ol>
                <li>Vá até <strong>Disparos</strong> no menu lateral</li>
                <li>Selecione a campanha e os leads que receberão a mensagem</li>
                <li>Clique em <strong>"Enviar"</strong></li>
              </ol>

              <h4>Status das mensagens</h4>
              <p>
                Cada mensagem enviada tem um status que é atualizado em tempo real:
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Significado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Pendente</td>
                      <td className="px-4 py-2">Aguardando envio</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Enviado</td>
                      <td className="px-4 py-2">Mensagem saiu do sistema</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Entregue</td>
                      <td className="px-4 py-2">Chegou no celular do cliente</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Lido</td>
                      <td className="px-4 py-2">Cliente abriu a mensagem</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Respondeu</td>
                      <td className="px-4 py-2">Cliente enviou uma resposta</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">Falhou</td>
                      <td className="px-4 py-2">Erro no envio (número inválido, etc.)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4>Reenviar mensagens com falha</h4>
              <p>
                Mensagens com status <strong>"Falhou"</strong> podem ser reenviadas.
                Verifique se o número está correto antes de tentar novamente.
              </p>
            </div>
          </section>

          {/* 8. Dashboard */}
          <section id="dashboard" className="scroll-mt-6">
            <SectionTitle icon={BarChart3} title="Dashboard" />
            <div className="prose-content">
              <p>
                O Dashboard mostra os principais números do seu workspace em tempo real.
              </p>

              <h4>KPIs (Indicadores)</h4>
              <ul>
                <li><strong>Total de leads</strong> — Quantos contatos você tem cadastrados</li>
                <li><strong>Mensagens enviadas</strong> — Total de disparos realizados</li>
                <li><strong>Taxa de resposta</strong> — Percentual de clientes que responderam</li>
                <li><strong>Convertidos</strong> — Clientes que voltaram a comprar</li>
              </ul>

              <h4>Funil de conversão</h4>
              <p>
                O gráfico de funil mostra quantos leads estão em cada etapa,
                do primeiro contato até a conversão. Quanto mais largo o funil no final, melhor!
              </p>

              <h4>Gráfico semanal</h4>
              <p>
                Acompanhe a evolução dos seus disparos e respostas semana a semana
                para identificar os melhores dias e horários.
              </p>
            </div>
          </section>

          {/* 9. Configurações */}
          <section id="configuracoes" className="scroll-mt-6">
            <SectionTitle icon={Settings} title="Configurações" />
            <div className="prose-content">
              <h4>Nome do workspace</h4>
              <p>
                Altere o nome do seu workspace, que aparece no canto superior do sistema.
              </p>

              <h4>WhatsApp API</h4>
              <p>
                Configure a conexão com a API do WhatsApp Business.
                Você vai precisar do <strong>Token de acesso</strong> e do <strong>ID do número</strong>
                fornecidos pela Meta (Facebook).
              </p>

              <h4>Gerenciar membros</h4>
              <p>
                Adicione pessoas da sua equipe e defina os papéis:
              </p>
              <ul>
                <li><strong>Admin</strong> — Acesso total, pode alterar configurações e membros</li>
                <li><strong>Gestor</strong> — Pode criar campanhas, importar leads e ver relatórios</li>
                <li><strong>Operador</strong> — Pode enviar disparos e gerenciar leads</li>
              </ul>
            </div>
          </section>

          {/* 10. Dúvidas Frequentes */}
          <section id="duvidas" className="scroll-mt-6">
            <SectionTitle icon={HelpCircle} title="Dúvidas Frequentes" />
            <div className="prose-content">
              <FaqItem question="O telefone não foi importado corretamente">
                Verifique se a coluna de telefone na planilha contém apenas números ou está no formato
                (XX) XXXXX-XXXX. Evite espaços extras ou caracteres especiais. O sistema aceita
                formatos variados e normaliza automaticamente.
              </FaqItem>

              <FaqItem question="O lead não aparece no Pipeline">
                Leads recém-importados aparecem na coluna "Novo". Se o lead não está aparecendo,
                verifique se ele foi importado corretamente na página de Leads. Leads duplicados
                (mesmo telefone) são ignorados na importação.
              </FaqItem>

              <FaqItem question="A mensagem falhou ao enviar">
                Possíveis causas:
                <ul className="mt-2">
                  <li>O número do WhatsApp está incorreto ou não existe</li>
                  <li>O cliente bloqueou o número da empresa</li>
                  <li>A API do WhatsApp está com problema temporário</li>
                  <li>O token de acesso expirou (verifique em Configurações)</li>
                </ul>
              </FaqItem>

              <FaqItem question="Como sei se o cliente leu a mensagem?">
                O status muda para "Lido" quando o cliente abre a mensagem (equivalente ao
                "check azul" do WhatsApp). Nem todos os clientes têm confirmação de leitura
                ativada — nesses casos, o status fica em "Entregue".
              </FaqItem>

              <FaqItem question="Posso enviar mensagens para qualquer número?">
                Envie mensagens apenas para clientes que já tiveram relacionamento com sua
                empresa. O uso indevido pode resultar em bloqueio do número pela Meta.
                Sempre respeite o opt-out de clientes que pedirem para não receber mensagens.
              </FaqItem>

              <FaqItem question="Quantas mensagens posso enviar por dia?">
                O limite depende do nível da sua conta na API do WhatsApp Business.
                Contas novas começam com 250 mensagens/dia e podem escalar até 100.000/dia
                conforme o uso e qualidade das conversas.
              </FaqItem>
            </div>
          </section>
        </div>

        {/* Back to top */}
        <div className="mt-12 mb-8 flex justify-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
            Voltar ao topo
          </button>
        </div>
      </main>
    </div>
  );
};

/* ── Helper Components ──────────────────────────────────────────── */

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h3 className="flex items-center gap-3 text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </h3>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm text-foreground">
      {children}
    </div>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-border bg-card p-4">
      <h4 className="font-medium text-foreground mb-2">{question}</h4>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default Manual;
