import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  Megaphone,
  Kanban,
  Settings,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Imports", href: "/imports", icon: Upload },
  { name: "Campanhas", href: "/campaigns", icon: Megaphone },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Disparos", href: "/dispatches", icon: MessageSquare },
  { name: "Configurações", href: "/settings", icon: Settings },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  operador: "Operador",
};

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, currentBrand, currentRole, signOut } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <MessageSquare className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">ReConnect</h1>
          <p className="text-xs text-muted-foreground">CRM WhatsApp</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {profile?.display_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {profile?.display_name || "Usuário"}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs text-muted-foreground">
                {currentBrand?.name || "Sem marca"}
              </span>
              {currentRole && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  {roleLabels[currentRole] || currentRole}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
