import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

interface WhatsAppSession {
  id: string;
  status: "disconnected" | "connecting" | "qr_code" | "connected";
  phone_number: string | null;
  qr_code: string | null;
  webhook_url: string | null;
  last_connected_at: string | null;
}

interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  profile_picture: string | null;
  unread_count: number;
  last_message_at: string | null;
}

interface WhatsAppMessage {
  id: string;
  contact_id: string;
  content: string;
  message_type: string;
  media_url: string | null;
  is_from_me: boolean;
  status: string;
  sent_at: string;
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

  // Configurar webhook
  const setWebhookUrl = useCallback(async (webhookUrl: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "set_webhook", webhook_url: webhookUrl },
      });

      if (error) throw error;

      toast({
        title: "Webhook configurado",
        description: "URL do servidor externo salva com sucesso.",
      });

      await fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao configurar webhook:", err);
      toast({
        title: "Erro",
        description: "Não foi possível configurar o webhook.",
        variant: "destructive",
      });
      return false;
    }
  }, [fetchSession, toast]);

  // Conectar WhatsApp
  const connect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "connect" },
      });

      if (error) throw error;

      toast({
        title: "Iniciando conexão",
        description: "Aguarde o servidor gerar o QR Code...",
      });

      await fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao conectar:", err);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão.",
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

      return data.message_id;
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Marcar como lido
  const markAsRead = useCallback(async (contactId: string) => {
    if (!profile?.company_id) return;

    try {
      await supabase
        .from("whatsapp_contacts")
        .update({ unread_count: 0 })
        .eq("id", contactId);

      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error("Erro ao marcar como lido:", err);
    }
  }, [profile?.company_id]);

  // Carregar dados iniciais
  useEffect(() => {
    if (profile?.company_id) {
      setLoading(true);
      Promise.all([fetchSession(), fetchContacts()]).finally(() => {
        setLoading(false);
      });
    }
  }, [profile?.company_id, fetchSession, fetchContacts]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!profile?.company_id) return;

    // Subscribe to session updates
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
          }
        }
      )
      .subscribe();

    // Subscribe to contacts updates
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
              prev.map((c) => (c.id === payload.new.id ? (payload.new as WhatsAppContact) : c))
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
    setWebhookUrl,
    sendMessage,
    fetchMessages,
    markAsRead,
    refetch: () => Promise.all([fetchSession(), fetchContacts()]),
  };
}
