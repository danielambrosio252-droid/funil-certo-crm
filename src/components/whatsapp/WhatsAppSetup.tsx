import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cloud, QrCode, MessageCircle } from "lucide-react";
import { WhatsAppCloudSetup } from "./WhatsAppCloudSetup";
import { WhatsAppBaileysSetup } from "./WhatsAppBaileysSetup";

export function WhatsAppSetup() {
  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">WhatsApp Business</h2>
            <p className="text-emerald-100 text-sm">Central de atendimento integrada</p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <Tabs defaultValue="cloud_api" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cloud_api" className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              API Oficial
            </TabsTrigger>
            <TabsTrigger value="baileys" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              WhatsApp Web
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cloud_api" className="mt-6">
            <WhatsAppCloudSetup />
          </TabsContent>

          <TabsContent value="baileys" className="mt-6">
            <WhatsAppBaileysSetup />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
