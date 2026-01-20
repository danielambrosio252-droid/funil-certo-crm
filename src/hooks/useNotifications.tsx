import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NotificationSettings {
  newLeads: boolean;
  whatsappMessages: boolean;
  weeklyReports: boolean;
  systemUpdates: boolean;
}

export interface AppNotification {
  id: string;
  type: "new_lead" | "whatsapp_message";
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: Record<string, any>;
}

// Som de notificação usando Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Criar um som de notificação agradável
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Som de "ding" agradável
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.type = "sine";
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log("Audio não suportado:", error);
  }
}

// Get last seen timestamp from localStorage
function getLastSeenTimestamp(): Date {
  const stored = localStorage.getItem("notifications_last_seen");
  if (stored) {
    return new Date(stored);
  }
  // Default to 24 hours ago if never seen
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date;
}

function setLastSeenTimestamp(date: Date) {
  localStorage.setItem("notifications_last_seen", date.toISOString());
}

export function useNotifications() {
  const { company, profile } = useAuth();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [settings, setSettings] = useState<NotificationSettings>({
    newLeads: true,
    whatsappMessages: true,
    weeklyReports: true,
    systemUpdates: true,
  });
  const [lastSeen, setLastSeen] = useState<Date>(getLastSeenTimestamp);
  const subscriptionRef = useRef<any>(null);

  // Fetch recent leads (created after last seen)
  const { data: recentLeads = [] } = useQuery({
    queryKey: ["recent-leads-notifications", company?.id, lastSeen.toISOString()],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from("funnel_leads")
        .select("id, name, source, created_at")
        .eq("company_id", company.id)
        .gte("created_at", lastSeen.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!company?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread WhatsApp messages count
  const { data: unreadWhatsApp = 0 } = useQuery({
    queryKey: ["unread-whatsapp-count", company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("unread_count")
        .eq("company_id", company.id)
        .gt("unread_count", 0);

      if (error) throw error;
      return data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
    },
    enabled: !!company?.id,
    refetchInterval: 30000,
  });

  // Build notifications list
  const notifications: AppNotification[] = useMemo(() => {
    const items: AppNotification[] = [];

    // Add new leads as notifications
    recentLeads.forEach((lead) => {
      items.push({
        id: `lead-${lead.id}`,
        type: "new_lead",
        title: "Novo Lead",
        message: `${lead.name}${lead.source ? ` via ${lead.source}` : ""}`,
        createdAt: new Date(lead.created_at),
        read: false,
        data: { leadId: lead.id },
      });
    });

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [recentLeads]);

  // Total unread count
  const unreadCount = useMemo(() => {
    return recentLeads.length + unreadWhatsApp;
  }, [recentLeads.length, unreadWhatsApp]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const now = new Date();
    setLastSeen(now);
    setLastSeenTimestamp(now);
    queryClient.invalidateQueries({ queryKey: ["recent-leads-notifications"] });
  }, [queryClient]);

  // Verificar permissão de notificação
  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Solicitar permissão de notificação
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      toast.error("Seu navegador não suporta notificações");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast.success("Notificações ativadas!");
        // Testar som
        playNotificationSound();
        return true;
      } else {
        toast.error("Permissão de notificação negada");
        return false;
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão:", error);
      return false;
    }
  }, []);

  // Enviar notificação
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== "granted") {
      console.log("Permissão de notificação não concedida");
      return;
    }

    try {
      // Tocar som
      playNotificationSound();

      // Criar notificação
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "funilcerto-" + Date.now(),
        ...options,
      });

      // Focar na aba quando clicar na notificação
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-fechar após 5 segundos
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
    }
  }, [permission]);

  // Notificar novo lead
  const notifyNewLead = useCallback((leadName: string, funnelName?: string) => {
    if (!settings.newLeads) return;

    sendNotification("🎯 Novo Lead!", {
      body: `${leadName} entrou${funnelName ? ` no funil "${funnelName}"` : ""}`,
      requireInteraction: false,
    });
  }, [settings.newLeads, sendNotification]);

  // Notificar nova mensagem WhatsApp
  const notifyWhatsAppMessage = useCallback((contactName: string, message: string) => {
    if (!settings.whatsappMessages) return;

    sendNotification(`💬 ${contactName}`, {
      body: message.length > 50 ? message.substring(0, 50) + "..." : message,
      requireInteraction: false,
    });
  }, [settings.whatsappMessages, sendNotification]);

  // Configurar listener de realtime para novos leads
  useEffect(() => {
    if (!company?.id || permission !== "granted" || !settings.newLeads) {
      return;
    }

    // Subscrever a novos leads
    const channel = supabase
      .channel('new-leads-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'funnel_leads',
          filter: `company_id=eq.${company.id}`,
        },
        async (payload) => {
          const lead = payload.new as { name: string; stage_id: string };
          
          // Invalidate queries to update count
          queryClient.invalidateQueries({ queryKey: ["recent-leads-notifications"] });
          
          // Buscar nome do funil
          const { data: stage } = await supabase
            .from('funnel_stages')
            .select('funnel_id, funnels(name)')
            .eq('id', lead.stage_id)
            .single();
          
          const funnelName = (stage as any)?.funnels?.name;
          notifyNewLead(lead.name, funnelName);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [company?.id, permission, settings.newLeads, notifyNewLead, queryClient]);

  // Atualizar configurações
  const updateSettings = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Se ativando e não tem permissão, solicitar
    if (value && permission !== "granted") {
      requestPermission();
    }
  }, [permission, requestPermission]);

  return {
    permission,
    settings,
    notifications,
    unreadCount,
    unreadWhatsApp,
    recentLeadsCount: recentLeads.length,
    markAllAsRead,
    requestPermission,
    updateSettings,
    sendNotification,
    notifyNewLead,
    notifyWhatsAppMessage,
    playNotificationSound,
  };
}
