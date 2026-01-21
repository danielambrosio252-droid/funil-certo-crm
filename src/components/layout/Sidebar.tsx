import { useState, createContext, useContext, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Kanban, label: "Funis", path: "/funnels" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: MessageCircle, label: "WhatsApp", path: "/whatsapp" },
  { icon: Zap, label: "Fluxos", path: "/flows" },
  { icon: Mail, label: "E-mail Marketing", path: "/email" },
  { icon: BarChart3, label: "Meta Ads", path: "/meta-ads" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

// Context for sidebar state
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  isMobile: false,
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { collapsed } = useSidebar();

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
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
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
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
        </AnimatePresence>
      </div>
    </>
  );
}

// Desktop Sidebar
function DesktopSidebar() {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex-col z-50 hidden lg:flex"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <h1 className="font-bold text-lg text-sidebar-foreground whitespace-nowrap">Escala Certo</h1>
                <span className="text-xs text-sidebar-foreground/60 font-medium">PRO</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <SidebarContent />
    </motion.aside>
  );
}

// Mobile Sidebar (Sheet)
function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm shadow-md"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">Escala Certo</h1>
              <span className="text-xs text-sidebar-foreground/60 font-medium">PRO</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
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
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="p-4 rounded-xl bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 border border-sidebar-border">
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
