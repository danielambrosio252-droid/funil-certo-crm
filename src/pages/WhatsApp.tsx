import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { WhatsAppTemplates } from "@/components/whatsapp/WhatsAppTemplates";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useFFmpegPreload } from "@/hooks/useFFmpegPreload";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, FileText } from "lucide-react";

export default function WhatsApp() {
  const [searchParams] = useSearchParams();
  const { contacts, isConnected, whatsappMode, loading } = useWhatsApp();
  const [activeTab, setActiveTab] = useState("chat");
  
  // Get phone and name from URL params (from lead click)
  const initialPhone = searchParams.get("phone") || undefined;
  const initialName = searchParams.get("name") || undefined;
  
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Header with tabs and status */}
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
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </TabsTrigger>
            </TabsList>
            
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

          {/* Chat tab */}
          <TabsContent value="chat" className="mt-0 flex-1 min-h-0">
            <WhatsAppChat initialPhone={initialPhone} initialName={initialName} />
          </TabsContent>

          {/* Templates tab */}
          <TabsContent value="templates" className="mt-0 flex-1 min-h-0">
            <div className="bg-card rounded-xl p-4 h-full overflow-hidden">
              <WhatsAppTemplates />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
