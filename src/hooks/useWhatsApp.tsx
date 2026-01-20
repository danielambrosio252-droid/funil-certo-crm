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

export type QrStatus = "CONNECTING" | "QR" | "CONNECTED" | "ERROR" | "DISCONNECTED";

export interface QrResponse {
  status: QrStatus;
  qr?: string;
  phone_number?: string;
  reason?: string;
  pending_age_ms?: number;
}

export function useWhatsApp() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState<string | null>(null);
  const [cloudApiConfigured, setCloudApiConfigured] = useState(false);
  const hasFetched = useRef(false);

  const fetchCompanyConfig = useCallback(async () => {
    const companyId = profile?.company_id;
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("whatsapp_mode, whatsapp_phone_number_id, whatsapp_waba_id")
        .eq("id", companyId)
        .single();

      if (error) {
        console.error("Erro ao buscar config da empresa:", error);
        return;
      }

      setWhatsappMode(data?.whatsapp_mode || null);
      setCloudApiConfigured(
        data?.whatsapp_mode === "cloud_api" &&
        !!data?.whatsapp_phone_number_id &&
        !!data?.whatsapp_waba_id
      );
    } catch (err) {
      console.error("Erro ao buscar config da empresa:", err);
    }
  }, [profile?.company_id]);

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

  const fetchMessages = useCallback(async (contactId: string): Promise<WhatsAppMessage[]> => {
    if (!profile?.company_id) return [];

    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: true })
        .limit(500);

      if (error) {
        console.error("Erro ao buscar mensagens:", error);
        return [];
      }

      return (data || []) as WhatsAppMessage[];
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
      return [];
    }
  }, [profile?.company_id]);

  // Fetch QR code - retorna status DETERMINÍSTICO
  const fetchQrCode = useCallback(async (): Promise<QrResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-qr");

      if (error) {
        console.error("Erro ao buscar QR:", error);
        return { status: "ERROR", reason: "invoke_error" };
      }

      return data || { status: "ERROR", reason: "no_data" };
    } catch (err) {
      console.error("Erro ao buscar QR:", err);
      return { status: "ERROR", reason: "exception" };
    }
  }, []);

  const connect = useCallback(async (forceReset = false) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "connect", force_reset: forceReset },
      });

      if (error) {
        console.error("Erro ao conectar:", error);
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a conexão.",
          variant: "destructive",
        });
        return false;
      }

      if (data?.success && data?.status === "CONNECTING") {
        return true;
      }

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.message || data.error,
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error("Erro ao conectar:", err);
      toast({
        title: "Erro",
        description: "Servidor indisponível.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "disconnect" },
      });

      if (error) {
        console.error("Erro ao desconectar:", error);
        return false;
      }

      fetchSession();
      return true;
    } catch (err) {
      console.error("Erro ao desconectar:", err);
      return false;
    }
  }, [fetchSession]);

  // NOVO: Reiniciar sessão (mantém credenciais)
  const restart = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "restart" },
      });

      if (error) {
        console.error("Erro ao reiniciar:", error);
        return false;
      }

      return data?.success || false;
    } catch (err) {
      console.error("Erro ao reiniciar:", err);
      return false;
    }
  }, []);

  // NOVO: Resetar sessão completamente (permite novo número)
  const reset = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "reset" },
      });

      if (error) {
        console.error("Erro ao resetar:", error);
        return false;
      }

      fetchSession();
      return data?.success || false;
    } catch (err) {
      console.error("Erro ao resetar:", err);
      return false;
    }
  }, [fetchSession]);

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

  const refetch = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([fetchSession(), fetchContacts(), fetchCompanyConfig()]);
    } finally {
      setSyncing(false);
    }
  }, [fetchSession, fetchContacts, fetchCompanyConfig]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.company_id) {
      setInitializing(false);
      hasFetched.current = true;
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    const doFetch = async () => {
      await Promise.all([fetchSession(), fetchContacts(), fetchCompanyConfig()]);
      setInitializing(false);
    };
    doFetch();
  }, [authLoading, profile?.company_id, fetchSession, fetchContacts, fetchCompanyConfig]);

  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) return;

    const sessionChannel = supabase
      .channel("whatsapp_sessions_changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_sessions",
        filter: `company_id=eq.${companyId}`,
      }, (payload) => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          setSession(payload.new as WhatsAppSession);
        } else if (payload.eventType === "DELETE") {
          setSession(null);
        }
      })
      .subscribe();

    const contactsChannel = supabase
      .channel("whatsapp_contacts_changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_contacts",
        filter: `company_id=eq.${companyId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setContacts((prev) => [payload.new as WhatsAppContact, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === (payload.new as WhatsAppContact).id ? (payload.new as WhatsAppContact) : c
            )
          );
        } else if (payload.eventType === "DELETE") {
          setContacts((prev) => prev.filter((c) => c.id !== (payload.old as WhatsAppContact).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [profile?.company_id]);

  // Determina se está conectado (Cloud API configurado OU sessão Baileys conectada)
  const isConnected = cloudApiConfigured || session?.status === "connected";

  return {
    session,
    contacts,
    initializing,
    syncing,
    loading: authLoading || initializing,
    isConnected,
    whatsappMode,
    cloudApiConfigured,
    connect,
    disconnect,
    restart,
    reset,
    sendMessage,
    fetchMessages,
    fetchQrCode,
    markAsRead,
    refetch,
  };
}
