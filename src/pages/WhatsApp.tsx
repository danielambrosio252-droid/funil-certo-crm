import { MainLayout } from "@/components/layout/MainLayout";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useFFmpegPreload } from "@/hooks/useFFmpegPreload";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export default function WhatsApp() {
  const { contacts, isConnected, whatsappMode, loading } = useWhatsApp();
  
  // Pre-load FFmpeg in background for faster audio recording
  useFFmpegPreload();
  
  const totalUnread = contacts.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const getConnectionLabel = () => {
    if (loading) return "Carregando...";
    if (isConnected) {
      return whatsappMode === "cloud_api" ? "API Oficial" : "Conectado";
    }
    return "Desconectado";
  };

  return (
    <MainLayout title="WhatsApp" subtitle="Central de atendimento">
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header with status */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <span className="font-medium">Conversas</span>
            {totalUnread > 0 && (
              <Badge className="h-5 min-w-[20px] px-1.5 bg-emerald-500 text-white">
                {totalUnread}
              </Badge>
            )}
          </div>
          
          {/* Connection status indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              loading ? 'bg-amber-400 animate-pulse' : 
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`} />
            <span className={`text-sm font-medium ${
              loading ? 'text-amber-600' :
              isConnected ? 'text-emerald-600' : 'text-muted-foreground'
            }`}>
              {getConnectionLabel()}
            </span>
          </div>
        </div>

        {/* Chat area takes full remaining space */}
        <div className="flex-1 min-h-0">
          <WhatsAppChat />
        </div>
      </div>
    </MainLayout>
  );
}
