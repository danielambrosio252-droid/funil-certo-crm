import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Image,
  Mic,
  Settings,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: "online" | "offline" | "typing";
  avatar?: string;
}

interface Message {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
}

const conversations: Conversation[] = [
  { id: "1", name: "Maria Santos", phone: "(11) 99999-0001", lastMessage: "Olá! Gostaria de saber mais sobre o produto", time: "Agora", unread: 2, status: "online" },
  { id: "2", name: "Carlos Oliveira", phone: "(21) 98888-0002", lastMessage: "Perfeito, vou analisar a proposta", time: "10:45", unread: 0, status: "offline" },
  { id: "3", name: "Ana Paula", phone: "(31) 97777-0003", lastMessage: "Você envia áudio sobre os planos?", time: "09:30", unread: 1, status: "typing" },
  { id: "4", name: "Roberto Almeida", phone: "(41) 96666-0004", lastMessage: "Fechado! Vamos prosseguir", time: "Ontem", unread: 0, status: "offline" },
  { id: "5", name: "Fernanda Dias", phone: "(51) 95555-0005", lastMessage: "Qual é o prazo de entrega?", time: "Ontem", unread: 0, status: "offline" },
];

const messages: Message[] = [
  { id: "1", content: "Olá! Vi o anúncio de vocês no Facebook", time: "10:00", sent: false, read: true },
  { id: "2", content: "Olá Maria! Tudo bem? Obrigado pelo contato! 😊", time: "10:02", sent: true, read: true },
  { id: "3", content: "Gostaria de saber mais sobre os planos disponíveis", time: "10:05", sent: false, read: true },
  { id: "4", content: "Claro! Temos 3 planos:\n\n📦 Básico - R$ 97/mês\n📦 Pro - R$ 197/mês\n📦 Enterprise - R$ 497/mês\n\nQual seria mais adequado para você?", time: "10:08", sent: true, read: true },
  { id: "5", content: "O plano Pro parece interessante. Quais são as funcionalidades?", time: "10:15", sent: false, read: true },
  { id: "6", content: "Ótima escolha! O plano Pro inclui:\n\n✅ Leads ilimitados\n✅ Integração WhatsApp\n✅ Meta Ads Dashboard\n✅ 5 usuários\n✅ Suporte prioritário", time: "10:18", sent: true, read: true },
  { id: "7", content: "Olá! Gostaria de saber mais sobre o produto", time: "10:25", sent: false, read: false },
];

export default function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<string>("1");
  const [messageInput, setMessageInput] = useState("");

  return (
    <MainLayout title="WhatsApp" subtitle="Central de atendimento">
      <div className="flex h-[calc(100vh-180px)] bg-card border border-border rounded-xl overflow-hidden">
        {/* Conversations List */}
        <div className="w-96 border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Conversas</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Link className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar conversas..." className="pl-10" />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            {conversations.map((conv) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                  "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedConversation === conv.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-success/20 text-success font-medium">
                        {conv.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    {conv.status === "online" && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground truncate">{conv.name}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{conv.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.status === "typing" ? (
                          <span className="text-success">Digitando...</span>
                        ) : (
                          conv.lastMessage
                        )}
                      </p>
                      {conv.unread > 0 && (
                        <Badge className="bg-success text-success-foreground ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {conv.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-success/20 text-success font-medium">MS</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">Maria Santos</p>
                <p className="text-xs text-success">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Phone className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon">
                <Video className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-muted/20 to-muted/5">
            <div className="space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.sent ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                      msg.sent
                        ? "bg-success text-success-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <div className={cn("flex items-center gap-1 mt-1", msg.sent ? "justify-end" : "justify-start")}>
                      <span className={cn("text-xs", msg.sent ? "text-success-foreground/70" : "text-muted-foreground")}>
                        {msg.time}
                      </span>
                      {msg.sent && (
                        <CheckCheck className={cn("w-4 h-4", msg.read ? "text-blue-400" : "text-success-foreground/50")} />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon">
                <Paperclip className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon">
                <Image className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Input
                placeholder="Digite uma mensagem..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1"
              />
              {messageInput ? (
                <Button size="icon" className="gradient-primary text-primary-foreground">
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon">
                  <Mic className="w-5 h-5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
