import { Bell, Search, Plus, User, LogOut, Settings, CreditCard, Menu } from "lucide-react";
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

interface HeaderProps {
  title: string;
  subtitle?: string;
  onNewLead?: () => void;
}

export function Header({ title, subtitle, onNewLead }: HeaderProps) {
  const { user, profile, company, signOut } = useAuth();
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
                // Navigate to leads page with search query
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </Button>

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
