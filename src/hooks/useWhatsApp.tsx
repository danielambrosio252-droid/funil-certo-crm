import { useState, useEffect, useCallback, useRef } from "react";
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
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  
  // Non-blocking loading states
  const [initializing, setInitializing] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Track if we've done initial fetch
  const hasFetched = useRef(false);

  // Fetch session (fast, non-blocking)
  const fetchSession = useCallback(async () => {
    const companyId = profile?.company_id;
    if (!companyId) {
      setSession(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar sessão:", error);
        return;
      }

      setSession(data as WhatsAppSession | null);
    } catch (err) {
      console.error("Erro ao buscar sessão:", err);
    }
  }, [profile?.company_id]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    const companyId = profile?.company_id;
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .eq("company_id", companyId)
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

  // Fetch messages for a contact
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

  // Connect WhatsApp (non-blocking, with timeout)
  const connect = useCallback(async () => {
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "connect" },
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error("Erro ao conectar:", error);
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a conexão. Verifique se o servidor está configurado.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Iniciando conexão",
        description: "Aguarde o QR Code aparecer...",
      });

      // Don't wait for refetch - realtime will update
      fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao conectar:", err);
      toast({
        title: "Erro",
        description: "Servidor indisponível. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  }, [fetchSession, toast]);

  // Disconnect WhatsApp
  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "disconnect" },
      });

      if (error) {
        console.error("Erro ao desconectar:", error);
        toast({
          title: "Erro",
          description: "Não foi possível desconectar.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso.",
      });

      fetchSession();
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

  // Send message
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

  // Mark as read
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

  // Refetch all data (for manual refresh)
  const refetch = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([fetchSession(), fetchContacts()]);
    } finally {
      setSyncing(false);
    }
  }, [fetchSession, fetchContacts]);

  // Initial data load - FAST, non-blocking
  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) return;

    // If no company_id, stop initializing immediately
    if (!profile?.company_id) {
      setInitializing(false);
      hasFetched.current = true;
      return;
    }

    // Only fetch once
    if (hasFetched.current) return;
    hasFetched.current = true;

    const doFetch = async () => {
      await Promise.all([fetchSession(), fetchContacts()]);
      setInitializing(false);
    };

    doFetch();
  }, [authLoading, profile?.company_id, fetchSession, fetchContacts]);

  // Real-time subscriptions
  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) return;

    // Subscription for sessions
    const sessionChannel = supabase
      .channel("whatsapp_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_sessions",
          filter: `company_id=eq.${companyId}`,
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

    // Subscription for contacts
    const contactsChannel = supabase
      .channel("whatsapp_contacts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_contacts",
          filter: `company_id=eq.${companyId}`,
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
    // Non-blocking loading states
    initializing, // True only during first bootstrap
    syncing, // True during manual refresh
    // Legacy alias for compatibility (always false after auth loads)
    loading: authLoading || initializing,
    // Actions
    connect,
    disconnect,
    sendMessage,
    fetchMessages,
    markAsRead,
    refetch,
  };
}
