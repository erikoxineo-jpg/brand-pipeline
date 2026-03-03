import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Monitor, MessageSquare, ArrowLeft } from "lucide-react";

const MobileWarning = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <Monitor className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Acesse pelo computador</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Para a melhor experiência com o painel do ReConnect, acesse pelo seu PC ou notebook.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <span className="text-sm text-muted-foreground">
          O CRM foi otimizado para telas maiores
        </span>
      </div>
      <Link to="/" className="mt-8">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para o site
        </Button>
      </Link>
    </div>
  );
};

export default MobileWarning;
