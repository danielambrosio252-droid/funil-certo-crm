import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppSetup } from "@/components/whatsapp/WhatsAppSetup";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { MessageSquare, Settings } from "lucide-react";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useFFmpegPreload } from "@/hooks/useFFmpegPreload";
import { Badge } from "@/components/ui/badge";

export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState("chat");
  const { contacts, isConnected, whatsappMode } = useWhatsApp();
  
  // Pre-load FFmpeg in background for faster audio recording
  useFFmpegPreload();
  
  const totalUnread = contacts.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const getConnectionLabel = () => {
    if (isConnected) {
      return whatsappMode === "cloud_api" ? "API Oficial" : "Conectado";
    }
    return "Desconectado";
  };

  return (
    <MainLayout title="WhatsApp" subtitle="Central de atendimento">
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="chat" className="flex items-center gap-2 relative">
                <MessageSquare className="w-4 h-4" />
                Conversas
                {totalUnread > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] px-1.5 bg-emerald-500 text-white">
                    {totalUnread}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="setup" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuração
              </TabsTrigger>
            </TabsList>
            
            {/* Connection status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-sm font-medium ${isConnected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {getConnectionLabel()}
              </span>
            </div>
          </div>

          <TabsContent value="chat" className="mt-0 flex-1 min-h-0">
            <WhatsAppChat />
          </TabsContent>

          <TabsContent value="setup" className="mt-0">
            <div className="max-w-2xl">
              <WhatsAppSetup />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
