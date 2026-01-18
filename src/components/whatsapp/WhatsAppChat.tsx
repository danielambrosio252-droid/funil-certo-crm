import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Smile,
  Paperclip,
  Mic,
  Phone,
  MoreVertical,
  User,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { contacts, session, sendMessage, fetchMessages, markAsRead } = useWhatsApp();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages when contact changes
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id).then(setMessages);
      markAsRead(selectedContact.id);
    }
  }, [selectedContact, fetchMessages, markAsRead]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedContact || !profile?.company_id) return;

    const channel = supabase
      .channel("whatsapp_messages_realtime")
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
          setMessages((prev) => {
            // Evitar duplicatas
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
  }, [selectedContact?.id, profile?.company_id]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedContact || sending) return;

    const content = messageInput.trim();
    setMessageInput("");
    setSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      contact_id: selectedContact.id,
      content,
      message_type: "text",
      media_url: null,
      is_from_me: true,
      status: "pending",
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    const messageId = await sendMessage(selectedContact.id, content);
    setSending(false);

    if (messageId) {
      // Update with real ID
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: messageId, status: "sent" } : m
        )
      );
    } else {
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        )
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredContacts = contacts.filter((c) =>
    (c.name || c.phone).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case "sent":
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-destructive" />;
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

  const isConnected = session?.status === "connected";

  return (
    <div className="flex h-[calc(100vh-180px)] bg-card border border-border rounded-xl overflow-hidden">
      {/* Contacts List */}
      <div className="w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {contacts.length === 0
                  ? "Nenhuma conversa ainda"
                  : "Nenhum resultado encontrado"}
              </p>
              {contacts.length === 0 && isConnected && (
                <p className="text-xs text-muted-foreground mt-2">
                  As conversas aparecerão quando você receber mensagens
                </p>
              )}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedContact(contact)}
                className={cn(
                  "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedContact?.id === contact.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    {contact.profile_picture ? (
                      <img src={contact.profile_picture} alt={contact.name || contact.phone} />
                    ) : (
                      <AvatarFallback className="bg-success/20 text-success font-medium">
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
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {contact.last_message_at && formatDate(contact.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.phone}
                      </p>
                      {contact.unread_count > 0 && (
                        <Badge className="bg-success text-success-foreground ml-2 h-5 min-w-[20px] p-0 flex items-center justify-center text-xs">
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
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-success/20 text-success font-medium">
                    {(selectedContact.name || selectedContact.phone)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {selectedContact.name || selectedContact.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-muted/20 to-muted/5">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn("flex", msg.is_from_me ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                          msg.is_from_me
                            ? "bg-success text-success-foreground rounded-br-md"
                            : "bg-card border border-border text-foreground rounded-bl-md",
                          msg.status === "failed" && "border-destructive/50"
                        )}
                      >
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1",
                            msg.is_from_me ? "justify-end" : "justify-start"
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs",
                              msg.is_from_me
                                ? "text-success-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatTime(msg.sent_at)}
                          </span>
                          {msg.is_from_me && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-card">
              {!isConnected ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Conecte o WhatsApp para enviar mensagens</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Smile className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                    disabled={sending}
                  />
                  {messageInput.trim() ? (
                    <Button
                      size="icon"
                      className="gradient-primary text-primary-foreground"
                      onClick={handleSend}
                      disabled={sending}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon">
                      <Mic className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <MessageSquare className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Escala Certo Pro - WhatsApp
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {isConnected
                ? "Selecione uma conversa para começar a atender"
                : "Conecte seu WhatsApp na aba de configuração para começar"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
