import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationSettings {
  newLeads: boolean;
  whatsappMessages: boolean;
  weeklyReports: boolean;
  systemUpdates: boolean;
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

export function useNotifications() {
  const { company, profile } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [settings, setSettings] = useState<NotificationSettings>({
    newLeads: true,
    whatsappMessages: true,
    weeklyReports: true,
    systemUpdates: true,
  });
  const subscriptionRef = useRef<any>(null);

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
  }, [company?.id, permission, settings.newLeads, notifyNewLead]);

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
    requestPermission,
    updateSettings,
    sendNotification,
    notifyNewLead,
    notifyWhatsAppMessage,
    playNotificationSound,
  };
}
