import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Wifi,
  WifiOff,
  QrCode,
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  ExternalLink,
  Copy,
} from "lucide-react";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useToast } from "@/hooks/use-toast";

export function WhatsAppSetup() {
  const { session, loading, connect, disconnect, setWebhookUrl } = useWhatsApp();
  const { toast } = useToast();
  const [webhookInput, setWebhookInput] = useState(session?.webhook_url || "");
  const [showSetup, setShowSetup] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleSaveWebhook = async () => {
    if (!webhookInput.trim()) {
      toast({
        title: "Erro",
        description: "Informe a URL do servidor",
        variant: "destructive",
      });
      return;
    }

    const success = await setWebhookUrl(webhookInput.trim());
    if (success) {
      setShowSetup(false);
    }
  };

  const handleConnect = async () => {
    if (!session?.webhook_url) {
      toast({
        title: "Configure o servidor",
        description: "Primeiro configure a URL do servidor Node.js externo.",
        variant: "destructive",
      });
      setShowSetup(true);
      return;
    }

    setConnecting(true);
    await connect();
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    await disconnect();
    setConnecting(false);
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência.",
    });
  };

  const getStatusConfig = () => {
    switch (session?.status) {
      case "connected":
        return {
          icon: CheckCircle2,
          color: "text-success",
          bgColor: "bg-success/10",
          label: "Conectado",
          description: session.phone_number || "WhatsApp conectado",
        };
      case "connecting":
        return {
          icon: Loader2,
          color: "text-warning",
          bgColor: "bg-warning/10",
          label: "Conectando",
          description: "Aguardando servidor...",
        };
      case "qr_code":
        return {
          icon: QrCode,
          color: "text-primary",
          bgColor: "bg-primary/10",
          label: "QR Code",
          description: "Escaneie o código no WhatsApp",
        };
      default:
        return {
          icon: WifiOff,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          label: "Desconectado",
          description: "WhatsApp não conectado",
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${status.bgColor} flex items-center justify-center`}>
              <StatusIcon className={`w-6 h-6 ${status.color} ${status.label === "Conectando" ? "animate-spin" : ""}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Status do WhatsApp</CardTitle>
              <CardDescription>{status.description}</CardDescription>
            </div>
          </div>
          <Badge
            variant={session?.status === "connected" ? "default" : "secondary"}
            className={session?.status === "connected" ? "bg-success text-success-foreground" : ""}
          >
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* QR Code Display */}
        {session?.status === "qr_code" && session.qr_code && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center p-6 bg-white rounded-xl border border-border"
          >
            <p className="text-sm text-muted-foreground mb-4">
              Escaneie este QR Code com seu WhatsApp
            </p>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <img
                src={session.qr_code}
                alt="QR Code WhatsApp"
                className="w-48 h-48"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar Aparelho
            </p>
          </motion.div>
        )}

        {/* Server Configuration */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Servidor Node.js</p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {session?.webhook_url || "Não configurado"}
              </p>
            </div>
          </div>

          <Dialog open={showSetup} onOpenChange={setShowSetup}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Configurar Servidor WhatsApp</DialogTitle>
                <DialogDescription>
                  Configure a URL do seu servidor Node.js com Baileys para gerenciar as sessões do WhatsApp.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL do Servidor Node.js</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://seu-servidor.com"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL base do seu servidor (sem /connect ou /send no final)
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <p className="text-sm font-medium">Webhook URL para receber eventos:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded text-xs break-all">
                      {import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook
                    </code>
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure seu servidor para enviar eventos (qr_code, connected, message_received) para este webhook.
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Servidor externo necessário</p>
                    <p className="text-muted-foreground">
                      Você precisa de um servidor Node.js rodando a biblioteca Baileys. 
                      Recomendamos hospedar no Railway ou Render.
                    </p>
                    <a
                      href="https://github.com/WhiskeySockets/Baileys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      Ver documentação <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSetup(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveWebhook}>
                  Salvar Configuração
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {session?.status === "connected" ? (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisconnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4 mr-2" />
              )}
              Desconectar
            </Button>
          ) : (
            <Button
              className="flex-1 gradient-primary"
              onClick={handleConnect}
              disabled={connecting || session?.status === "connecting" || session?.status === "qr_code"}
            >
              {connecting || session?.status === "connecting" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              {session?.status === "qr_code" ? "Aguardando escaneio..." : "Conectar WhatsApp"}
            </Button>
          )}
        </div>

        {session?.last_connected_at && (
          <p className="text-xs text-muted-foreground text-center">
            Última conexão: {new Date(session.last_connected_at).toLocaleString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
