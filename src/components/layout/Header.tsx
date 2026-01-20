import { Bell, Search, User, LogOut, Settings, CreditCard, MessageCircle, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onNewLead?: () => void;
}

export function Header({ title, subtitle, onNewLead }: HeaderProps) {
  const { user, profile, company, signOut } = useAuth();
  const { unreadCount, notifications, unreadWhatsApp, recentLeadsCount, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (notification.type === "new_lead") {
      navigate("/leads");
    } else if (notification.type === "whatsapp_message") {
      navigate("/whatsapp");
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
      {/* Left section with title */}
      <div className="flex items-center gap-4">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search - hidden on small screens */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads, funis..."
            className="w-48 xl:w-64 pl-10 bg-background/50"
            onChange={(e) => {
              const searchTerm = e.target.value.toLowerCase();
              if (searchTerm.length > 0) {
                navigate(`/leads?search=${encodeURIComponent(searchTerm)}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                const searchTerm = target.value.toLowerCase();
                if (searchTerm.length > 0) {
                  navigate(`/leads?search=${encodeURIComponent(searchTerm)}`);
                }
              }
            }}
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-2">
              <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-auto py-1" onClick={markAllAsRead}>
                  Marcar como lidas
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            
            {unreadCount === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Nenhuma notificação
              </div>
            ) : (
              <>
                {/* WhatsApp unread summary */}
                {unreadWhatsApp > 0 && (
                  <DropdownMenuItem 
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => navigate("/whatsapp")}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">WhatsApp</p>
                      <p className="text-xs text-muted-foreground">
                        {unreadWhatsApp} {unreadWhatsApp === 1 ? "mensagem não lida" : "mensagens não lidas"}
                      </p>
                    </div>
                  </DropdownMenuItem>
                )}

                {/* New leads summary */}
                {recentLeadsCount > 0 && (
                  <DropdownMenuItem 
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => navigate("/leads")}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Novos Leads</p>
                      <p className="text-xs text-muted-foreground">
                        {recentLeadsCount} {recentLeadsCount === 1 ? "novo lead" : "novos leads"} nas últimas horas
                      </p>
                    </div>
                  </DropdownMenuItem>
                )}

                {/* Individual notifications */}
                {notifications.slice(0, 5).map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id}
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notification.type === "new_lead" 
                        ? "bg-blue-100 dark:bg-blue-900/30" 
                        : "bg-green-100 dark:bg-green-900/30"
                    }`}>
                      {notification.type === "new_lead" ? (
                        <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {company && (
                  <p className="text-xs text-primary mt-1">{company.name}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <CreditCard className="w-4 h-4 mr-2" />
              Planos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
