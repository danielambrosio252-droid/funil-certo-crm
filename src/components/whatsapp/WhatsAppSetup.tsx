import { useState, useEffect, useRef, useCallback } from "react";
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

// State machine (frontend): explicit states, nunca spinner infinito
// (mantém a UI, só corrige o fluxo)
type UIState =
  | "IDLE"
  | "CONNECTING"
  | "WAITING_QR"
  | "QR_READY"
  | "CONNECTED"
  | "ERROR";

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}

const getStatusConfig = (status: UIState): StatusConfig => {
  switch (status) {
    case "CONNECTED":
      return {
        icon: <Check className="w-5 h-5" />,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 border-emerald-200",
        label: "Conectado",
        description: "WhatsApp funcionando perfeitamente",
      };
    case "CONNECTING":
      return {
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        color: "text-amber-600",
        bgColor: "bg-amber-50 border-amber-200",
        label: "Conectando",
        description: "Iniciando conexão...",
      };
    case "WAITING_QR":
      return {
        icon: <QrCode className="w-5 h-5" />,
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        label: "Gerando QR",
        description: "Aguarde: isso pode levar até 45 segundos",
      };
    case "QR_READY":
      return {
        icon: <QrCode className="w-5 h-5" />,
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        label: "QR pronto",
        description: "Escaneie o QR Code para conectar",
      };
    case "ERROR":
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        label: "Erro",
        description: "Falha na conexão. Tente novamente.",
      };
    case "IDLE":
    default:
      return {
        icon: <WifiOff className="w-5 h-5" />,
        color: "text-slate-500",
        bgColor: "bg-slate-50 border-slate-200",
        label: "Desconectado",
        description: "Clique para conectar seu WhatsApp",
      };
  }
};

export function WhatsAppSetup() {
  const { session, connect, disconnect, refetch, fetchQrCode, restart, reset, initializing } = useWhatsApp();
  const { toast } = useToast();

  const [showQrModal, setShowQrModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Explicit flow state (no infinite loading)
  const [uiState, setUiState] = useState<UIState>("IDLE");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const deriveBaseUIState = useCallback((): UIState => {
    if (!session) return "IDLE";
    const status = session.status;

    if (status === "connected") return "CONNECTED";
    if (status === "connecting") return "CONNECTING";
    if (status === "qr_code") return session.qr_code ? "QR_READY" : "WAITING_QR";
    if (status === "error") return "ERROR";

    return "IDLE";
  }, [session]);

  const baseUiState = deriveBaseUIState();
  const statusConfig = getStatusConfig(uiState);

  const clearConnectTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  const stopAllTimers = useCallback(() => {
    stopPolling();
    clearConnectTimeout();
    stopCountdown();
  }, [stopPolling, clearConnectTimeout, stopCountdown]);

  const closeModal = useCallback(() => {
    stopAllTimers();
    setShowQrModal(false);
    setActionLoading(false);
    setQrCode(null);
    setErrorMessage("");
    setUiState(baseUiState);
  }, [stopAllTimers, baseUiState]);

  const startQrPolling = useCallback(() => {
    // Always reset before starting to avoid parallel timers/pollers
    stopAllTimers();

    setUiState("WAITING_QR");
    setQrCode(null);
    setErrorMessage("");

    // Countdown (45s -> 0) - increased from 30s for better server initialization tolerance
    deadlineRef.current = Date.now() + 45_000;
    setSecondsLeft(45);
    countdownRef.current = setInterval(() => {
      if (!deadlineRef.current) return;
      const remainingMs = deadlineRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remainingSec);
    }, 250);

    // HARD TIMEOUT (45s): never allow infinite loading
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      timeoutRef.current = null;
      setSecondsLeft(0);
      setUiState("ERROR");
      setErrorMessage("Não foi possível gerar o QR Code no tempo esperado.");
      setActionLoading(false);
      stopCountdown();
    }, 45_000);

    pollingRef.current = setInterval(async () => {
      const result = await fetchQrCode();

      if (result.status === "QR" && result.qr) {
        setQrCode(result.qr);
        setUiState("QR_READY");
        setActionLoading(false);
        stopAllTimers();
        return;
      }

      if (result.status === "CONNECTED") {
        setUiState("CONNECTED");
        setActionLoading(false);
        stopAllTimers();
        setShowQrModal(false);
        refetch();
        return;
      }

      if (result.status === "ERROR") {
        setUiState("ERROR");
        setErrorMessage("Não foi possível gerar o QR Code.");
        setActionLoading(false);
        stopAllTimers();
        return;
      }

      // WAITING -> keep polling until timeout
    }, 2000);
  }, [fetchQrCode, refetch, stopAllTimers, stopPolling, stopCountdown]);

  // Cleanup
  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  // Keep UI state aligned with backend when NOT in a local flow
  useEffect(() => {
    if (baseUiState === "CONNECTED") {
      stopAllTimers();
      setShowQrModal(false);
      setActionLoading(false);
      setQrCode(null);
      setErrorMessage("");
      setUiState("CONNECTED");
      toast({
        title: "WhatsApp Conectado!",
        description: "Seu WhatsApp foi conectado com sucesso.",
      });
      return;
    }

    // If modal isn't open, keep state in sync with session
    if (!showQrModal) {
      setUiState(baseUiState);
    }
  }, [baseUiState, showQrModal, stopAllTimers, toast]);

  // If QR arrives via realtime/db, use it and stop polling
  useEffect(() => {
    if (session?.qr_code && showQrModal) {
      setQrCode(session.qr_code);
      setUiState("QR_READY");
      setActionLoading(false);
      stopAllTimers();
    }
  }, [session?.qr_code, showQrModal, stopAllTimers]);

  // If backend session goes to error while modal open
  useEffect(() => {
    if (baseUiState === "ERROR" && showQrModal) {
      stopAllTimers();
      setUiState("ERROR");
      setErrorMessage("Não foi possível gerar o QR Code.");
      setActionLoading(false);
    }
  }, [baseUiState, showQrModal, stopAllTimers]);

  const handleConnect = async () => {
    stopAllTimers();
    setQrCode(null);
    setErrorMessage("");

    setShowQrModal(true);
    setUiState("CONNECTING");

    // Spinner apenas no botão
    setActionLoading(true);

    try {
      const success = await connect();
      setActionLoading(false);

      if (success) {
        startQrPolling();
        return;
      }

      setUiState("ERROR");
      setErrorMessage("Não foi possível iniciar a conexão.");
    } catch {
      setActionLoading(false);
      setUiState("ERROR");
      setErrorMessage("Servidor indisponível. Verifique a configuração.");
      toast({
        title: "Erro ao conectar",
        description: "Servidor indisponível. Verifique a configuração.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    setQrCode(null);
    setErrorMessage("");
    stopAllTimers();

    try {
      await disconnect();
      setActionLoading(false);
      setUiState("IDLE");
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

  const handleRefreshQr = async () => {
    // "Atualizar" deve conseguir regenerar QR quando necessário
    if (uiState === "CONNECTED") {
      refetch();
      return;
    }

    await handleConnect();
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
                {uiState === "CONNECTED" && session?.phone_number && (
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
            {uiState === "CONNECTED" ? (
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
            ) : uiState === "ERROR" ? (
              <div className="flex flex-col gap-2 w-full">
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
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
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await restart();
                        toast({ title: "Sessão reiniciada", description: "Tente conectar novamente." });
                        handleConnect();
                      } catch {
                        toast({ title: "Erro", description: "Falha ao reiniciar sessão.", variant: "destructive" });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reiniciar Sessão
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await reset();
                        toast({ title: "Sessão resetada", description: "Todos os dados removidos. Conecte novamente." });
                        setUiState("IDLE");
                        refetch();
                      } catch {
                        toast({ title: "Erro", description: "Falha ao resetar sessão.", variant: "destructive" });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    <WifiOff className="w-4 h-4 mr-2" />
                    Resetar Tudo
                  </Button>
                </div>
              </div>
            ) : uiState === "CONNECTING" || uiState === "WAITING_QR" || uiState === "QR_READY" ? (
              <>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setShowQrModal(true)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {uiState === "QR_READY" ? "Ver QR Code" : "Aguardando QR..."}
                </Button>
                <Button variant="ghost" onClick={closeModal}>
                  Cancelar
                </Button>
              </>
            ) : (
              // IDLE - main action
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
          {uiState === "CONNECTED" && (
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
      <Dialog
        open={showQrModal}
        onOpenChange={(open) => {
          if (open) setShowQrModal(true);
          else closeModal();
        }}
      >
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
              {uiState === "ERROR" ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-64 rounded-2xl bg-muted flex flex-col items-center justify-center gap-3 p-6"
                >
                  <AlertCircle className="w-10 h-10 text-destructive" />
                  <p className="text-sm font-medium">
                    {errorMessage || "Não foi possível gerar o QR Code"}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {errorMessage
                      ? ""
                      : "Verifique se o servidor do WhatsApp está online e tente novamente."}
                  </p>
                  <Button variant="outline" onClick={handleRetry} disabled={actionLoading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar novamente
                  </Button>
                </motion.div>
              ) : uiState !== "QR_READY" || !qrCode ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-64 h-64 rounded-2xl bg-muted flex flex-col items-center justify-center gap-4"
                >
                  <QrCode className="w-10 h-10 text-emerald-500" />
                  <p className="text-sm text-muted-foreground">
                    {uiState === "CONNECTING"
                      ? "Iniciando conexão..."
                      : "Gerando QR Code… isso pode levar até 30 segundos"}
                  </p>
                  {(uiState === "WAITING_QR" || uiState === "CONNECTING") && (
                    <p className="text-xs text-muted-foreground">
                      Tempo restante: <span className="font-medium">{secondsLeft}s</span>
                    </p>
                  )}
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
                      src={qrCode}
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
              onClick={closeModal}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshQr}
              className="flex-1"
              disabled={actionLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${actionLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
