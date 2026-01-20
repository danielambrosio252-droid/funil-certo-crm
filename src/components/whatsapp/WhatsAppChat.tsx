import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Send,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Smile,
  Mic,
  Phone,
  MoreVertical,
  MessageSquare,
  Wifi,
  WifiOff,
  Plus,
  UserPlus,
  Image,
  FileText,
  Video,
  Play,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalPhone, normalizePhone } from "@/lib/phoneNormalizer";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MediaUploadButton } from "./MediaUploadButton";

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  profile_picture: string | null;
  unread_count: number;
  last_message_at: string | null;
}

interface Message {
  id: string;
  contact_id: string;
  content: string;
  message_type: string;
  media_url: string | null;
  is_from_me: boolean;
  status: string;
  sent_at: string;
}

export function WhatsAppChat() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { contacts, isConnected, sendMessage, fetchMessages, markAsRead, loading, refetch } = useWhatsApp();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const sendLockRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  
  // Mensagem pendente exibida separadamente (NÃO no array messages)
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    timestamp: string;
  } | null>(null);
  
  // Estado para indicador de "digitando..."
  const [contactTyping, setContactTyping] = useState<{
    contactId: string;
    presence: "composing" | "recording";
  } | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages when contact changes
  useEffect(() => {
    if (selectedContact) {
      // Limpar mensagens ao trocar de contato para evitar flash de mensagens antigas
      setMessages([]);
      setPendingMessage(null);
      pendingContentRef.current = null;
      
      fetchMessages(selectedContact.id).then((msgs) => {
        console.log(`[WhatsApp] Carregadas ${msgs.length} mensagens para contato ${selectedContact.id}`);
        // Log para debug
        const fromMe = msgs.filter(m => m.is_from_me).length;
        const received = msgs.filter(m => !m.is_from_me).length;
        console.log(`[WhatsApp] Enviadas: ${fromMe}, Recebidas: ${received}`);
        setMessages(msgs);
      });
      markAsRead(selectedContact.id);
    }
  }, [selectedContact?.id, fetchMessages, markAsRead]);

  // Rastrear o conteúdo da mensagem pendente para reconciliação
  const pendingContentRef = useRef<string | null>(null);

  // Notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant notification tone
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {
      console.log("Could not play notification sound:", err);
    }
  }, []);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedContact || !profile?.company_id) return;

    const channel = supabase
      .channel(`whatsapp_messages_${selectedContact.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `contact_id=eq.${selectedContact.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // Se a mensagem é nossa e bate com a pendente, limpar pendente
          if (newMessage.is_from_me && pendingContentRef.current === newMessage.content) {
            pendingContentRef.current = null;
            setPendingMessage(null);
          }
          
          // Play sound for incoming messages (not from me)
          if (!newMessage.is_from_me) {
            playNotificationSound();
          }
          
          setMessages((prev) => {
            // Evitar duplicatas por ID
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_messages",
          filter: `contact_id=eq.${selectedContact.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact?.id, profile?.company_id, playNotificationSound]);

  // Subscribe to typing indicators via broadcast
  useEffect(() => {
    if (!profile?.company_id) return;

    const typingChannel = supabase
      .channel(`typing:${profile.company_id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { contact_id, presence } = payload.payload as {
          contact_id: string;
          phone: string;
          presence: "composing" | "recording";
        };

        // Só mostrar se for do contato selecionado
        if (selectedContact?.id === contact_id) {
          setContactTyping({ contactId: contact_id, presence });

          // Limpar após 3 segundos sem nova atualização
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setContactTyping(null);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [profile?.company_id, selectedContact?.id]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedContact) return;

    // Trava síncrona para evitar disparos múltiplos (clique duplo / Enter repetido)
    if (sendLockRef.current) return;
    sendLockRef.current = true;

    const content = messageInput.trim();
    setMessageInput("");
    setSending(true);

    // Definir mensagem pendente (exibida separadamente, fora do array)
    pendingContentRef.current = content;
    setPendingMessage({
      content,
      timestamp: new Date().toISOString(),
    });

    try {
      const messageId = await sendMessage(selectedContact.id, content);

      if (!messageId || typeof messageId !== "string") {
        // Falhou - limpar pendente e mostrar erro
        pendingContentRef.current = null;
        setPendingMessage(null);
        toast.error("Erro ao enviar mensagem");
      }
      // Se sucesso, o realtime INSERT vai adicionar a mensagem e limpar a pendente
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((e as any).repeat) return;
      handleSend();
    }
  };

  const filteredContacts = contacts.filter((c) =>
    (c.name || c.phone).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateConversation = async () => {
    if (!newPhoneNumber.trim() || !profile?.company_id) return;

    // Clean and normalize the phone number
    const cleanPhone = normalizePhone(newPhoneNumber);
    
    if (!cleanPhone || cleanPhone.length < 12) {
      toast.error("Número de telefone inválido");
      return;
    }

    setCreatingConversation(true);

    try {
      // Check if contact already exists (comparing normalized phones)
      const existingContact = contacts.find(c => normalizePhone(c.phone) === cleanPhone);
      
      if (existingContact) {
        setSelectedContact(existingContact);
        setNewConversationOpen(false);
        setNewPhoneNumber("");
        setNewContactName("");
        setCreatingConversation(false);
        toast.info("Conversa já existe");
        return;
      }

      // Create new contact in database with normalized phone
      const { data: newContact, error } = await supabase
        .from("whatsapp_contacts")
        .insert({
          company_id: profile.company_id,
          phone: cleanPhone, // ✅ Telefone normalizado E.164
          normalized_phone: cleanPhone,
          name: newContactName.trim() || null,
          is_group: false,
          unread_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh contacts and select the new one
      await refetch();
      
      setSelectedContact({
        id: newContact.id,
        phone: newContact.phone,
        name: newContact.name,
        profile_picture: newContact.profile_picture,
        unread_count: 0,
        last_message_at: null,
      });

      setNewConversationOpen(false);
      setNewPhoneNumber("");
      setNewContactName("");
      toast.success("Conversa criada com sucesso!");
    } catch (error) {
      console.error("Erro ao criar conversa:", error);
      toast.error("Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3 h-3 text-white/60" />;
      case "sent":
        return <Check className="w-3 h-3 text-white/60" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-white/60" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-red-300" />;
      default:
        return null;
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return formatTime(date);
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    } else {
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
  };


  // Not connected state - ALWAYS show this immediately, don't wait for loading
  // This ensures users can always take action
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] bg-card border border-border rounded-xl p-8">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
          <WifiOff className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          WhatsApp Desconectado
        </h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Conecte seu WhatsApp para começar a receber e enviar mensagens aos seus clientes.
        </p>
        <Button 
          onClick={() => navigate("/settings")}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
        >
          <Wifi className="w-4 h-4 mr-2" />
          Conectar WhatsApp
        </Button>
        {loading && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Sincronizando...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Contacts List */}
      <div className="w-80 lg:w-96 border-r border-border flex flex-col bg-background">
        {/* Search Header */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                className="pl-10 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="icon" 
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-500" />
                    Nova Conversa
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Número de WhatsApp *
                    </label>
                    <Input
                      placeholder="Ex: 5583999999999"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite o número com código do país (55 para Brasil)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Nome do Contato (opcional)
                    </label>
                    <Input
                      placeholder="Ex: João Silva"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    onClick={handleCreateConversation}
                    disabled={!newPhoneNumber.trim() || creatingConversation}
                  >
                    {creatingConversation ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Iniciar Conversa
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status indicator */}
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-700 font-medium">WhatsApp conectado</span>
          </div>
          <span className="text-xs text-emerald-600">{contacts.length} conversas</span>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {contacts.length === 0 ? "Nenhuma conversa" : "Nenhum resultado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {contacts.length === 0
                  ? "Novas conversas aparecerão aqui"
                  : "Tente buscar por outro termo"}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedContact(contact)}
                className={cn(
                  "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-all duration-200",
                  selectedContact?.id === contact.id && "bg-emerald-50 hover:bg-emerald-50 border-l-2 border-l-emerald-500"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-background shadow-sm">
                    {contact.profile_picture ? (
                      <img src={contact.profile_picture} alt={contact.name || contact.phone} className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-medium">
                        {(contact.name || contact.phone)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground truncate">
                        {contact.name || contact.phone}
                      </p>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {contact.last_message_at && formatDate(contact.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">
                        {formatLocalPhone(contact.phone)}
                      </p>
                      {contact.unread_count > 0 && (
                        <Badge className="bg-emerald-500 text-white ml-2 h-5 min-w-[20px] p-0 flex items-center justify-center text-xs shadow-sm">
                          {contact.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 ring-2 ring-emerald-100">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-medium">
                    {(selectedContact.name || selectedContact.phone)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedContact.name || selectedContact.phone}
                  </p>
                  {contactTyping?.contactId === selectedContact.id ? (
                    <p className="text-xs text-emerald-600 font-medium animate-pulse">
                      {contactTyping.presence === "recording" ? "Gravando áudio..." : "Digitando..."}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatLocalPhone(selectedContact.phone)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-3xl mx-auto">
                {/* Debug: Total de mensagens */}
                {messages.length > 0 && (
                  <div className="text-center mb-4">
                    <span className="text-xs text-muted-foreground bg-slate-100 px-3 py-1 rounded-full">
                      {messages.length} mensagens carregadas
                    </span>
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn("flex", msg.is_from_me === true ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl shadow-sm overflow-hidden",
                          msg.is_from_me === true
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-br-md"
                            : "bg-white text-foreground rounded-bl-md border border-slate-200",
                          msg.status === "failed" && "ring-2 ring-red-300",
                          msg.message_type !== "text" && msg.media_url ? "p-1" : "px-4 py-2.5"
                        )}
                      >
                        {/* Renderizar mídia se existir */}
                        {msg.message_type === "image" && msg.media_url && (
                          <div className="mb-1">
                            <img 
                              src={msg.media_url} 
                              alt="Imagem" 
                              className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(msg.media_url!, "_blank")}
                            />
                          </div>
                        )}
                        {msg.message_type === "video" && msg.media_url && (
                          <div className="mb-1 relative">
                            <video 
                              src={msg.media_url} 
                              className="rounded-xl max-w-full max-h-64"
                              controls
                            />
                          </div>
                        )}
                        {msg.message_type === "audio" && msg.media_url && (
                          <div className="mb-1 px-2 py-1">
                            <audio 
                              src={msg.media_url} 
                              className="w-full max-w-[250px]"
                              controls
                            />
                          </div>
                        )}
                        {msg.message_type === "document" && msg.media_url && (
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-xl mb-1",
                              msg.is_from_me ? "bg-white/10 hover:bg-white/20" : "bg-slate-50 hover:bg-slate-100"
                            )}
                          >
                            <FileText className={cn("w-8 h-8", msg.is_from_me ? "text-white" : "text-purple-600")} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", msg.is_from_me ? "text-white" : "text-foreground")}>
                                Documento
                              </p>
                              <p className={cn("text-xs", msg.is_from_me ? "text-white/70" : "text-muted-foreground")}>
                                Clique para abrir
                              </p>
                            </div>
                            <Download className={cn("w-4 h-4", msg.is_from_me ? "text-white/70" : "text-muted-foreground")} />
                          </a>
                        )}
                        
                        {/* Conteúdo de texto */}
                        {(msg.message_type === "text" || msg.content) && msg.content !== `[${msg.message_type?.toUpperCase()}]` && (
                          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", msg.message_type !== "text" && msg.media_url && "px-3 pb-1")}>
                            {msg.content}
                          </p>
                        )}
                        
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1",
                            msg.is_from_me === true ? "justify-end" : "justify-start",
                            msg.message_type !== "text" && msg.media_url && "px-3 pb-1"
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px]",
                              msg.is_from_me === true
                                ? "text-white/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatTime(msg.sent_at)}
                          </span>
                          {msg.is_from_me === true && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Mensagem pendente (exibida separadamente enquanto envia) */}
                <AnimatePresence>
                  {pendingMessage && (
                    <motion.div
                      key="pending-message"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-br-md opacity-80">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{pendingMessage.content}</p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <span className="text-[10px] text-white/70">
                            {formatTime(pendingMessage.timestamp)}
                          </span>
                          <Clock className="w-3 h-3 text-white/60" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Indicador de digitando (contato) */}
                <AnimatePresence>
                  {contactTyping?.contactId === selectedContact?.id && (
                    <motion.div
                      key="typing-indicator"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-white">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                  <Smile className="w-5 h-5 text-muted-foreground" />
                </Button>
                <MediaUploadButton
                  disabled={sending}
                  onMediaSelected={async (media) => {
                    if (!selectedContact) return;
                    setSending(true);
                    try {
                      await sendMessage(selectedContact.id, media.caption || `[${media.type.toUpperCase()}]`, {
                        messageType: media.type,
                        mediaUrl: media.url,
                        mediaFilename: media.filename,
                        mediaCaption: media.caption,
                      });
                    } finally {
                      setSending(false);
                    }
                  }}
                />
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 rounded-full bg-slate-100 border-0 focus-visible:ring-emerald-500"
                  disabled={sending}
                />
                {messageInput.trim() ? (
                  <Button
                    size="icon"
                    className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                    <Mic className="w-5 h-5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-white to-slate-50">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mb-6 shadow-lg">
              <MessageSquare className="w-12 h-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Central de Atendimento
            </h3>
            <p className="text-muted-foreground max-w-sm">
              Selecione uma conversa à esquerda para começar a atender seus clientes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
