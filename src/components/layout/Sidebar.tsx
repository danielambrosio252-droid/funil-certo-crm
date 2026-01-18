import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Kanban,
  MessageCircle,
  Mail,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Kanban, label: "Funis", path: "/funnels" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: MessageCircle, label: "WhatsApp", path: "/whatsapp" },
  { icon: Mail, label: "E-mail Marketing", path: "/email" },
  { icon: BarChart3, label: "Meta Ads", path: "/meta-ads" },
  { icon: TrendingUp, label: "Relatórios", path: "/reports" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="font-bold text-lg text-sidebar-foreground">Escala Certo</h1>
              <span className="text-xs text-sidebar-foreground/60 font-medium">PRO</span>
            </motion.div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive && "drop-shadow-sm"
              )} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium text-sm"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-xl bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 border border-sidebar-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-sidebar-primary" />
              <span className="text-xs font-semibold text-sidebar-foreground">Plano Pro</span>
            </div>
            <p className="text-xs text-sidebar-foreground/60 mb-3">
              Leads ilimitados • Integrações completas
            </p>
            <div className="w-full bg-sidebar-border rounded-full h-1.5">
              <div className="bg-sidebar-primary h-1.5 rounded-full w-3/4" />
            </div>
            <p className="text-xs text-sidebar-foreground/50 mt-2">750/1000 leads este mês</p>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}
