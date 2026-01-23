import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Headphones, MessageSquare, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatLocalPhone } from "@/lib/phoneNormalizer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactInService {
  id: string;
  phone: string;
  name: string | null;
  profile_picture: string | null;
  tags: string[];
  last_message_at: string | null;
}

interface HumanTakeoverPanelProps {
  onSelectContact?: (contactId: string, phone: string, name: string | null) => void;
}

export function HumanTakeoverPanel({ onSelectContact }: HumanTakeoverPanelProps) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<ContactInService[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchContactsInService = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("id, phone, name, profile_picture, tags, last_message_at")
        .eq("company_id", profile.company_id)
        .contains("tags", ["em_atendimento"])
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      setContacts(data || []);
    } catch (err) {
      console.error("Erro ao buscar contatos em atendimento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchContactsInService();
    }
  }, [open, profile?.company_id]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!profile?.company_id || !open) return;

    const channel = supabase
      .channel("human_takeover_contacts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_contacts",
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          fetchContactsInService();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, open]);

  const handleReleaseToBot = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const newTags = (contact.tags || []).filter(t => t !== "em_atendimento");

      const { error } = await supabase
        .from("whatsapp_contacts")
        .update({ tags: newTags })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Contato liberado para o bot");
      fetchContactsInService();
    } catch (err) {
      console.error("Erro ao liberar contato:", err);
      toast.error("Erro ao liberar contato");
    }
  };

  const handleSelectContact = (contact: ContactInService) => {
    if (onSelectContact) {
      onSelectContact(contact.id, contact.phone, contact.name);
    }
    setOpen(false);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative gap-2"
        >
          <Headphones className="w-4 h-4" />
          Em Atendimento
          {contacts.length > 0 && (
            <Badge className="ml-1 h-5 min-w-[20px] px-1.5 bg-amber-500 text-white">
              {contacts.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-amber-500" />
            Contatos em Atendimento Humano
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Headphones className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">
                Nenhum contato em atendimento
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando um contato for transferido para um atendente, aparecerá aqui
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-150px)]">
              <div className="space-y-2 pr-4">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer",
                      "bg-amber-500/10 border border-amber-500/20",
                      "hover:bg-amber-500/20 transition-colors"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-amber-500/20 text-amber-700">
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">
                          {contact.name || formatLocalPhone(contact.phone)}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(contact.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.name ? formatLocalPhone(contact.phone) : ""}
                        </p>
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30 shrink-0">
                          <Headphones className="w-3 h-3 mr-1" />
                          Atendente
                        </Badge>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleReleaseToBot(contact.id, e)}
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                      title="Liberar para o bot"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
