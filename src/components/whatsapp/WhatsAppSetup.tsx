import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  QrCode,
  Check,
  AlertCircle,
  Loader2,
  MessageCircle,
  Shield
} from "lucide-react";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useToast } from "@/hooks/use-toast";

// State machine: UI always shows actions, never blocks
type UIState = "disconnected" | "connecting" | "qr_code" | "connected" | "error";

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}

const getStatusConfig = (status: UIState): StatusConfig => {
  switch (status) {
    case "connected":
      return {
        icon: <Check className="w-5 h-5" />,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 border-emerald-200",
        label: "Conectado",
        description: "WhatsApp funcionando perfeitamente"
      };
    case "connecting":
      return {
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        color: "text-amber-600",
        bgColor: "bg-amber-50 border-amber-200",
        label: "Conectando",
        description: "Preparando conexão..."
      };
    case "qr_code":
      return {
        icon: <QrCode className="w-5 h-5" />,
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        label: "Aguardando",
        description: "Escaneie o QR Code para conectar"
      };
    case "error":
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        label: "Erro",
        description: "Falha na conexão. Tente novamente."
      };
    default:
      return {
        icon: <WifiOff className="w-5 h-5" />,
        color: "text-slate-500",
        bgColor: "bg-slate-50 border-slate-200",
        label: "Desconectado",
        description: "Clique para conectar seu WhatsApp"
      };
  }
};

export function WhatsAppSetup() {
  const { session, connect, disconnect, refetch, initializing } = useWhatsApp();
  const { toast } = useToast();
  const [showQrModal, setShowQrModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Derive UI state from session, with explicit fallback to "disconnected"
  const deriveUIState = (): UIState => {
    if (!session) return "disconnected";
    const status = session.status;
    if (status === "connected") return "connected";
    if (status === "connecting") return "connecting";
    if (status === "qr_code") return "qr_code";
    if (status === "error") return "error";
    return "disconnected";
  };

  const uiState = deriveUIState();
  const statusConfig = getStatusConfig(uiState);

  // Auto-open QR modal when QR code is available
  useEffect(() => {
    if (uiState === "qr_code" && session?.qr_code) {
      setShowQrModal(true);
      setActionLoading(false);
    }
  }, [uiState, session?.qr_code]);

  // Auto-close modal when connected
  useEffect(() => {
    if (uiState === "connected") {
      setShowQrModal(false);
      setActionLoading(false);
      toast({
        title: "WhatsApp Conectado!",
        description: "Seu WhatsApp foi conectado com sucesso.",
      });
    }
  }, [uiState, toast]);

  // Handle error state
  useEffect(() => {
    if (uiState === "error") {
      setActionLoading(false);
    }
  }, [uiState]);

  const handleConnect = async () => {
    setActionLoading(true);
    setShowQrModal(true); // Open modal immediately (shows "Gerando QR Code...")
    
    try {
      const success = await connect();
      if (!success) {
        setActionLoading(false);
        toast({
          title: "Erro ao conectar",
          description: "Não foi possível iniciar a conexão. Tente novamente.",
          variant: "destructive",
        });
      }
      // If success, realtime will update status to qr_code/connected
    } catch {
      setActionLoading(false);
      toast({
        title: "Erro ao conectar",
        description: "Servidor indisponível. Verifique a configuração.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await disconnect();
      setActionLoading(false);
      toast({
        title: "WhatsApp Desconectado",
        description: "Sua sessão foi encerrada com sucesso.",
      });
    } catch {
      setActionLoading(false);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar.",
        variant: "destructive",
      });
    }
  };

  const handleReconnect = async () => {
    await handleDisconnect();
    setTimeout(() => {
      handleConnect();
    }, 500);
  };

  const handleRetry = () => {
    handleConnect();
  };

  // NEVER block with full-screen loading - always show actionable UI
  return (
    <>
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

        <CardContent className="p-6 space-y-6">
          {/* Syncing indicator (subtle, non-blocking) */}
          {initializing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Sincronizando...</span>
            </div>
          )}

          {/* Status Card - ALWAYS visible */}
          <motion.div 
            className={`flex items-center gap-4 p-4 rounded-xl border-2 ${statusConfig.bgColor}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={uiState}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusConfig.color} bg-white shadow-sm`}>
              {statusConfig.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                {uiState === "connected" && session?.phone_number && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {session.phone_number}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
            </div>
            
            {/* Refresh button - always visible */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetch()} 
              className="shrink-0"
              disabled={actionLoading}
            >
              <RefreshCw className={`w-4 h-4 ${initializing ? 'animate-spin' : ''}`} />
            </Button>
          </motion.div>

          {/* Action Buttons - ALWAYS visible based on state */}
          <div className="flex gap-3">
            {uiState === "connected" ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReconnect}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reconectar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                >
                  <WifiOff className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </>
            ) : uiState === "error" ? (
              <>
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
                  onClick={handleRetry}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Tentar Novamente
                </Button>
              </>
            ) : uiState === "connecting" || uiState === "qr_code" ? (
              <>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setShowQrModal(true)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {uiState === "qr_code" ? "Ver QR Code" : "Aguardando QR..."}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowQrModal(false);
                    setActionLoading(false);
                  }}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              // DISCONNECTED - main action
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Features info */}
          {uiState === "connected" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-3 gap-3 pt-4 border-t"
            >
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <MessageCircle className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Mensagens</p>
                <p className="font-semibold text-sm">Ativo</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Shield className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Segurança</p>
                <p className="font-semibold text-sm">Criptografado</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Smartphone className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Sincronizado</p>
                <p className="font-semibold text-sm">Em tempo real</p>
              </div>
            </motion.div>
          )}

          {/* Last connection info */}
          {session?.last_connected_at && (
            <p className="text-xs text-muted-foreground text-center">
              Última conexão: {new Date(session.last_connected_at).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-emerald-600" />
              </div>
              <span>Conectar WhatsApp</span>
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Escaneie o código QR com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-6">
            <AnimatePresence mode="wait">
              {!session?.qr_code ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-64 h-64 rounded-2xl bg-muted flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                  <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
                </motion.div>
              ) : (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative"
                >
                  <div className="p-4 bg-white rounded-2xl shadow-lg">
                    <img
                      src={session.qr_code}
                      alt="QR Code para conectar WhatsApp"
                      className="w-56 h-56 rounded-lg"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-3 text-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-medium">1</span>
              Abra o WhatsApp no seu celular
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-medium">2</span>
              Toque em Menu → Aparelhos conectados
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-medium">3</span>
              Escaneie o código QR acima
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowQrModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
