import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface WhatsAppSession {
  id: string;
  company_id: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppContact {
  id: string;
  company_id: string;
  phone: string;
  name: string | null;
  profile_picture: string | null;
  is_group: boolean;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  company_id: string;
  contact_id: string;
  message_id: string | null;
  content: string;
  message_type: string;
  media_url: string | null;
  is_from_me: boolean;
  status: string;
  sent_at: string;
  created_at: string;
}

export function useWhatsApp() {
  const { profile, company } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar sessão
  const fetchSession = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("company_id", profile.company_id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao buscar sessão:", error);
        return;
      }

      setSession(data as WhatsAppSession | null);
    } catch (err) {
      console.error("Erro ao buscar sessão:", err);
    }
  }, [profile?.company_id]);

  // Buscar contatos
  const fetchContacts = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Erro ao buscar contatos:", error);
        return;
      }

      setContacts(data as WhatsAppContact[]);
    } catch (err) {
      console.error("Erro ao buscar contatos:", err);
    }
  }, [profile?.company_id]);

  // Buscar mensagens de um contato
  const fetchMessages = useCallback(async (contactId: string): Promise<WhatsAppMessage[]> => {
    if (!profile?.company_id) return [];

    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: true });

      if (error) {
        console.error("Erro ao buscar mensagens:", error);
        return [];
      }

      return data as WhatsAppMessage[];
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
      return [];
    }
  }, [profile?.company_id]);

  // Conectar WhatsApp - agora sem expor URL do servidor
  const connect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "connect" },
      });

      if (error) throw error;

      toast({
        title: "Iniciando conexão",
        description: "Aguarde o QR Code aparecer...",
      });

      await fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao conectar:", err);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão. Verifique se o servidor está configurado.",
        variant: "destructive",
      });
      return false;
    }
  }, [fetchSession, toast]);

  // Desconectar WhatsApp
  const disconnect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "disconnect" },
      });

      if (error) throw error;

      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso.",
      });

      await fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao desconectar:", err);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar.",
        variant: "destructive",
      });
      return false;
    }
  }, [fetchSession, toast]);

  // Enviar mensagem
  const sendMessage = useCallback(async (contactId: string, content: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { contact_id: contactId, content },
      });

      if (error) throw error;

      return data?.message_id || true;
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Marcar como lido
  const markAsRead = useCallback(async (contactId: string) => {
    try {
      await supabase
        .from("whatsapp_contacts")
        .update({ unread_count: 0 })
        .eq("id", contactId);
    } catch (err) {
      console.error("Erro ao marcar como lido:", err);
    }
  }, []);

  // Refetch all data
  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSession(), fetchContacts()]);
    setLoading(false);
  }, [fetchSession, fetchContacts]);

  // Carregar dados iniciais
  useEffect(() => {
    if (profile?.company_id) {
      refetch();
    }
  }, [profile?.company_id, refetch]);

  // Real-time subscriptions
  useEffect(() => {
    if (!profile?.company_id) return;

    // Subscription para sessões
    const sessionChannel = supabase
      .channel("whatsapp_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_sessions",
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log("Sessão atualizada:", payload);
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setSession(payload.new as WhatsAppSession);
          } else if (payload.eventType === "DELETE") {
            setSession(null);
          }
        }
      )
      .subscribe();

    // Subscription para contatos
    const contactsChannel = supabase
      .channel("whatsapp_contacts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_contacts",
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log("Contato atualizado:", payload);
          if (payload.eventType === "INSERT") {
            setContacts((prev) => [payload.new as WhatsAppContact, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === (payload.new as WhatsAppContact).id
                  ? (payload.new as WhatsAppContact)
                  : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setContacts((prev) =>
              prev.filter((c) => c.id !== (payload.old as WhatsAppContact).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [profile?.company_id]);

  return {
    session,
    contacts,
    loading,
    connect,
    disconnect,
    sendMessage,
    fetchMessages,
    markAsRead,
    refetch,
  };
}
