import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Phone,
  MoreVertical,
  MessageSquare,
  Wifi,
  WifiOff,
  Plus,
  UserPlus,
  FileText,
  Download,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalPhone, normalizePhone } from "@/lib/phoneNormalizer";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MediaUploadButton } from "./MediaUploadButton";
import { AudioRecordButton } from "./AudioRecordButton";
import { AudioPlayer } from "./AudioPlayer";
import { TextImproveMenu } from "./TextImproveMenu";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { processAndSendAudioAsync } from "@/lib/audioProcessor";
import { useWhatsAppTemplates, WhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { WhatsAppFlow } from "@/hooks/useWhatsAppFlows";

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

interface WhatsAppChatProps {
  initialPhone?: string;
  initialName?: string;
}

export function WhatsAppChat({ initialPhone, initialName }: WhatsAppChatProps = {}) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const hasAutoSelectedRef = useRef(false);
  
  // Mensagem pendente exibida separadamente (NÃO no array messages)
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    timestamp: string;
    type?: "text" | "audio";
    isProcessing?: boolean;
  } | null>(null);
  
  // Audio processing counter for UI feedback
  const [audioProcessingCount, setAudioProcessingCount] = useState(0);
  
  // Slash command menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const { sendTemplate } = useWhatsAppTemplates();
  
  // Estado para indicador de "digitando..."
  const [contactTyping, setContactTyping] = useState<{
    contactId: string;
    presence: "composing" | "recording";
  } | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-select contact from initialPhone prop
  useEffect(() => {
    if (!initialPhone || hasAutoSelectedRef.current || contacts.length === 0 || !profile?.company_id) return;
    
    const cleanPhone = normalizePhone(initialPhone);
    if (!cleanPhone) return;
    
    // Check if contact exists
    const existingContact = contacts.find(c => normalizePhone(c.phone) === cleanPhone);
    
    if (existingContact) {
      setSelectedContact(existingContact);
      hasAutoSelectedRef.current = true;
    } else {
      // Create new contact automatically
      const createContact = async () => {
        try {
          const { data: newContact, error } = await supabase
            .from("whatsapp_contacts")
            .insert({
              company_id: profile.company_id,
              phone: cleanPhone,
              normalized_phone: cleanPhone,
              name: initialName || null,
              is_group: false,
              unread_count: 0,
            })
            .select()
            .single();

          if (error) throw error;

          await refetch();
          
          setSelectedContact({
            id: newContact.id,
            phone: newContact.phone,
            name: newContact.name,
            profile_picture: newContact.profile_picture,
            unread_count: 0,
            last_message_at: null,
          });
          
          hasAutoSelectedRef.current = true;
        } catch (error) {
          console.error("Error auto-creating contact:", error);
        }
      };
      
      createContact();
      hasAutoSelectedRef.current = true;
    }
  }, [initialPhone, initialName, contacts, profile?.company_id, refetch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [messageInput]);

  // Load messages when contact changes
  useEffect(() => {
    if (selectedContact) {
      // Limpar mensagens ao trocar de contato para evitar flash de mensagens antigas
      setMessages([]);
      setPendingMessage(null);
      pendingContentRef.current = null;
      
      fetchMessages(selectedContact.id).then((msgs) => {
        console.log(`[WhatsApp] Carregadas ${msgs.length} mensagens para contato ${selectedContact.id}`);
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
      
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1);
      
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
          
          if (newMessage.is_from_me) {
            if (pendingContentRef.current === newMessage.content) {
              pendingContentRef.current = null;
              setPendingMessage(null);
            }
            if (newMessage.message_type === "audio" && pendingMessage?.type === "audio") {
              setPendingMessage(null);
            }
          }
          
          if (!newMessage.is_from_me) {
            playNotificationSound();
          }
          
          setMessages((prev) => {
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
  }, [selectedContact?.id, profile?.company_id, playNotificationSound, pendingMessage]);

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

        if (selectedContact?.id === contact_id) {
          setContactTyping({ contactId: contact_id, presence });

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

    if (sendLockRef.current) return;
    sendLockRef.current = true;

    const content = messageInput.trim();
    setMessageInput("");
    setSending(true);

    pendingContentRef.current = content;
    setPendingMessage({
      content,
      timestamp: new Date().toISOString(),
    });

    try {
      const messageId = await sendMessage(selectedContact.id, content);

      if (!messageId || typeof messageId !== "string") {
        pendingContentRef.current = null;
        setPendingMessage(null);
        toast.error("Erro ao enviar mensagem");
      }
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  };

  const handleResend = async (msg: Message) => {
    if (!selectedContact || sending) return;
    
    setSending(true);
    try {
      await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("id", msg.id);
      
      const messageId = await sendMessage(selectedContact.id, msg.content, {
        messageType: msg.message_type as "text" | "image" | "video" | "audio" | "document",
        mediaUrl: msg.media_url || undefined,
      });

      if (!messageId || typeof messageId !== "string") {
        toast.error("Erro ao reenviar mensagem");
      } else {
        toast.success("Mensagem reenviada");
      }
    } catch (error) {
      console.error("Error resending message:", error);
      toast.error("Erro ao reenviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Detect "/" for slash commands
    if (e.key === "/" && messageInput === "") {
      e.preventDefault();
      setSlashMenuOpen(true);
      return;
    }
    
    // Close slash menu on Escape
    if (e.key === "Escape" && slashMenuOpen) {
      e.preventDefault();
      setSlashMenuOpen(false);
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey && !slashMenuOpen) {
      e.preventDefault();
      if ((e as any).repeat) return;
      handleSend();
    }
  };

  // Handle template selection from slash menu
  const handleSelectTemplate = async (template: WhatsAppTemplate) => {
    if (!selectedContact) return;
    
    // Send the template
    const success = await sendTemplate(
      selectedContact.id,
      template.name,
      template.language
    );
    
    if (success) {
      // Refresh messages
      const msgs = await fetchMessages(selectedContact.id);
      setMessages(msgs);
    }
  };

  // Handle flow selection from slash menu
  const handleSelectFlow = async (flow: WhatsAppFlow) => {
    if (!selectedContact || !profile?.company_id) return;
    
    try {
      // Trigger the flow for this contact
      const { error } = await supabase.functions.invoke("flow-executor", {
        body: {
          trigger_type: "manual",
          company_id: profile.company_id,
          contact_id: selectedContact.id,
          phone: selectedContact.phone,
          flow_id: flow.id,
        },
      });
      
      if (error) throw error;
      
      toast.success(`Fluxo "${flow.name}" iniciado!`);
    } catch (error) {
      console.error("Error triggering flow:", error);
      toast.error("Erro ao iniciar fluxo");
    }
  };

  const filteredContacts = contacts.filter((c) =>
    (c.name || c.phone).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateConversation = async () => {
    if (!newPhoneNumber.trim() || !profile?.company_id) return;

    const cleanPhone = normalizePhone(newPhoneNumber);
    
    if (!cleanPhone || cleanPhone.length < 12) {
      toast.error("Número de telefone inválido");
      return;
    }

    setCreatingConversation(true);

    try {
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

      const { data: newContact, error } = await supabase
        .from("whatsapp_contacts")
        .insert({
          company_id: profile.company_id,
          phone: cleanPhone,
          normalized_phone: cleanPhone,
          name: newContactName.trim() || null,
          is_group: false,
          unread_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

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
      case "processing":
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card rounded-xl p-8">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Carregando WhatsApp...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card rounded-xl p-8">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <WifiOff className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">WhatsApp Desconectado</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          Conecte seu WhatsApp para começar a atender seus clientes.
        </p>
        <Button 
          onClick={() => navigate("/settings")}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          <Wifi className="w-4 h-4 mr-2" />
          Ir para Configurações
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background rounded-xl overflow-hidden border border-border">
      {/* Contacts List - Compact */}
      <div className="w-72 lg:w-80 border-r border-border flex flex-col bg-card">
        {/* Search Header - Compact */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                className="pl-8 h-9 text-sm bg-muted/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 shrink-0">
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
                    <label className="text-sm font-medium mb-2 block">Número de WhatsApp *</label>
                    <Input
                      placeholder="Ex: 5583999999999"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite o número com código do país (55 para Brasil)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nome (opcional)</label>
                    <Input
                      placeholder="Ex: João Silva"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={handleCreateConversation}
                    disabled={!newPhoneNumber.trim() || creatingConversation}
                  >
                    {creatingConversation ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

        {/* Status indicator - Compact */}
        <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-700">Conectado</span>
          </div>
          <span className="text-xs text-emerald-600">{contacts.length} conversas</span>
        </div>

        {/* Contacts List */}
        <ScrollArea className="flex-1">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {contacts.length === 0 ? "Nenhuma conversa" : "Nenhum resultado"}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={cn(
                  "px-3 py-2.5 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedContact?.id === contact.id && "bg-emerald-50 hover:bg-emerald-50 border-l-2 border-l-emerald-500"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-10 h-10">
                    {contact.profile_picture ? (
                      <img src={contact.profile_picture} alt="" className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-emerald-500 text-white text-sm">
                        {(contact.name || contact.phone).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{contact.name || formatLocalPhone(contact.phone)}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {contact.last_message_at && formatDate(contact.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.name ? formatLocalPhone(contact.phone) : ""}
                      </p>
                      {contact.unread_count > 0 && (
                        <Badge className="bg-emerald-500 text-white h-4 min-w-4 p-0 flex items-center justify-center text-[10px]">
                          {contact.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedContact ? (
          <>
            {/* Chat Header - Compact */}
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-emerald-500 text-white text-sm">
                    {(selectedContact.name || selectedContact.phone).substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedContact.name || formatLocalPhone(selectedContact.phone)}</p>
                  {contactTyping?.contactId === selectedContact.id ? (
                    <p className="text-xs text-emerald-600 animate-pulse">
                      {contactTyping.presence === "recording" ? "Gravando áudio..." : "Digitando..."}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatLocalPhone(selectedContact.phone)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Messages - Full space */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2 max-w-4xl mx-auto">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn("flex", msg.is_from_me ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl shadow-sm overflow-hidden",
                          msg.is_from_me
                            ? "bg-emerald-500 text-white rounded-br-sm"
                            : "bg-white text-foreground rounded-bl-sm border border-slate-200",
                          msg.status === "failed" && "ring-2 ring-red-300",
                          msg.message_type !== "text" && msg.media_url ? "p-1" : "px-3 py-2"
                        )}
                      >
                        {/* Media content */}
                        {msg.message_type === "image" && msg.media_url && (
                          <div className="mb-1">
                            <img 
                              src={msg.media_url} 
                              alt="Imagem" 
                              className="rounded-xl max-w-full max-h-52 object-cover cursor-pointer hover:opacity-90"
                              onClick={() => window.open(msg.media_url!, "_blank")}
                            />
                          </div>
                        )}
                        {msg.message_type === "video" && msg.media_url && (
                          <div className="mb-1">
                            <video src={msg.media_url} className="rounded-xl max-w-full max-h-52" controls />
                          </div>
                        )}
                        {msg.message_type === "audio" && msg.media_url && (
                          <AudioPlayer src={msg.media_url} isFromMe={msg.is_from_me} />
                        )}
                        {msg.message_type === "document" && msg.media_url && (
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-xl mb-1",
                              msg.is_from_me ? "bg-white/10 hover:bg-white/20" : "bg-slate-50 hover:bg-slate-100"
                            )}
                          >
                            <FileText className={cn("w-6 h-6", msg.is_from_me ? "text-white" : "text-purple-600")} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-medium truncate", msg.is_from_me ? "text-white" : "text-foreground")}>
                                Documento
                              </p>
                            </div>
                            <Download className={cn("w-3 h-3", msg.is_from_me ? "text-white/70" : "text-muted-foreground")} />
                          </a>
                        )}
                        
                        {/* Text content */}
                        {(msg.message_type === "text" || msg.content) && msg.content !== `[${msg.message_type?.toUpperCase()}]` && (
                          <p className={cn("whitespace-pre-wrap text-sm", msg.message_type !== "text" && msg.media_url && "px-2 pb-1")}>
                            {msg.content}
                          </p>
                        )}
                        
                        <div className={cn(
                          "flex items-center gap-1 mt-0.5",
                          msg.is_from_me ? "justify-end" : "justify-start",
                          msg.message_type !== "text" && msg.media_url && "px-2 pb-1"
                        )}>
                          {msg.status === "failed" && msg.is_from_me && (
                            <button
                              onClick={() => handleResend(msg)}
                              disabled={sending}
                              className="flex items-center gap-1 text-[10px] text-white/90 bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded-full mr-1"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Reenviar
                            </button>
                          )}
                          <span className={cn("text-[10px]", msg.is_from_me ? "text-white/70" : "text-muted-foreground")}>
                            {formatTime(msg.sent_at)}
                          </span>
                          {msg.is_from_me && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Pending message */}
                <AnimatePresence>
                  {pendingMessage && (
                    <motion.div
                      key="pending-message"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[70%] rounded-2xl px-3 py-2 shadow-sm bg-emerald-500 text-white rounded-br-sm opacity-80">
                        <p className="whitespace-pre-wrap text-sm">{pendingMessage.content}</p>
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <span className="text-[10px] text-white/70">{formatTime(pendingMessage.timestamp)}</span>
                          <Clock className="w-2.5 h-2.5 text-white/60" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Typing indicator */}
                <AnimatePresence>
                  {contactTyping?.contactId === selectedContact?.id && (
                    <motion.div
                      key="typing-indicator"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area - Enhanced with AI */}
            <div className="p-3 border-t border-border bg-white">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 mb-0.5">
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
                <TextImproveMenu 
                  text={messageInput}
                  onTextImproved={setMessageInput}
                  disabled={sending}
                />
                <div className="flex-1 relative">
                  {/* Slash Command Menu */}
                  <SlashCommandMenu
                    isOpen={slashMenuOpen}
                    onClose={() => setSlashMenuOpen(false)}
                    onSelectTemplate={handleSelectTemplate}
                    onSelectFlow={handleSelectFlow}
                    inputRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
                  />
                  <Textarea
                    ref={textareaRef}
                    placeholder="Digite / para atalhos..."
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      // Close menu if user clears input
                      if (e.target.value === "" && slashMenuOpen) {
                        setSlashMenuOpen(false);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    className="min-h-[36px] max-h-[120px] py-2 px-3 resize-none rounded-2xl bg-slate-100 border-0 focus-visible:ring-emerald-500 text-sm"
                    disabled={sending}
                    rows={1}
                  />
                </div>
                {messageInput.trim() ? (
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 shrink-0 mb-0.5"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 mb-0.5">
                    <AudioRecordButton
                      disabled={sending}
                      onRecordingComplete={(data) => {
                        if (!selectedContact || !profile?.company_id) return;
                        
                        setPendingMessage({
                          content: "[AUDIO]",
                          timestamp: new Date().toISOString(),
                          type: "audio",
                          isProcessing: true,
                        });
                        setAudioProcessingCount(prev => prev + 1);
                        
                        processAndSendAudioAsync({
                          blob: data.blob,
                          mimeType: data.mimeType,
                          duration: data.duration,
                          contactId: selectedContact.id,
                          companyId: profile.company_id,
                          tempMessageId: `temp-audio-${Date.now()}`,
                        }).finally(() => {
                          setAudioProcessingCount(prev => Math.max(0, prev - 1));
                        });
                      }}
                    />
                    {audioProcessingCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Central de Atendimento</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Selecione uma conversa para começar a atender
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
