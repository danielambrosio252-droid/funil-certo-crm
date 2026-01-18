import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppSetup } from "@/components/whatsapp/WhatsAppSetup";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { MessageSquare, Settings } from "lucide-react";

export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <MainLayout title="WhatsApp" subtitle="Central de atendimento">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0">
          <WhatsAppChat />
        </TabsContent>

        <TabsContent value="setup" className="mt-0">
          <div className="max-w-2xl">
            <WhatsAppSetup />
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
