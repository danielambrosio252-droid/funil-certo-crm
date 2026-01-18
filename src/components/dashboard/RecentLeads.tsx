import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Phone, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const recentLeads = [
  {
    id: 1,
    name: "Maria Santos",
    email: "maria@email.com",
    phone: "(11) 99999-0001",
    source: "Meta Ads",
    stage: "Qualificação",
    time: "2 min atrás",
  },
  {
    id: 2,
    name: "Carlos Oliveira",
    email: "carlos@empresa.com",
    phone: "(21) 98888-0002",
    source: "WhatsApp",
    stage: "Proposta",
    time: "15 min atrás",
  },
  {
    id: 3,
    name: "Ana Paula",
    email: "ana.paula@gmail.com",
    phone: "(31) 97777-0003",
    source: "Formulário",
    stage: "Novo Lead",
    time: "1 hora atrás",
  },
  {
    id: 4,
    name: "Roberto Almeida",
    email: "roberto@corp.com",
    phone: "(41) 96666-0004",
    source: "Meta Ads",
    stage: "Negociação",
    time: "2 horas atrás",
  },
];

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info border-info/20",
  "WhatsApp": "bg-success/10 text-success border-success/20",
  "Formulário": "bg-warning/10 text-warning border-warning/20",
};

export function RecentLeads() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-xl shadow-sm"
    >
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Leads Recentes</h3>
          <p className="text-sm text-muted-foreground">Últimos leads capturados</p>
        </div>
        <Link
          to="/leads"
          className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {recentLeads.map((lead, index) => (
          <motion.div
            key={lead.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {lead.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{lead.name}</p>
                  <p className="text-sm text-muted-foreground">{lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={sourceColors[lead.source]}>
                  {lead.source}
                </Badge>
                <span className="text-xs text-muted-foreground">{lead.time}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {lead.stage}
              </Badge>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
