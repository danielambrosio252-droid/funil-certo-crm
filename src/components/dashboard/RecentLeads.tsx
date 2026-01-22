import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Phone, Mail, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppChoiceDialog, useWhatsAppChoice } from "@/components/whatsapp/WhatsAppChoiceDialog";

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info border-info/20",
  "WhatsApp": "bg-success/10 text-success border-success/20",
  "Formulário": "bg-warning/10 text-warning border-warning/20",
  "Webhook": "bg-primary/10 text-primary border-primary/20",
  "Manual": "bg-muted text-muted-foreground border-border",
};

export function RecentLeads() {
  const { profile } = useAuth();
  const whatsAppChoice = useWhatsAppChoice();

  const { data: recentLeads, isLoading } = useQuery({
    queryKey: ['recent-leads', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from('funnel_leads')
        .select(`
          id,
          name,
          email,
          phone,
          source,
          created_at,
          stage_id,
          funnel_stages (
            name
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const getSourceColor = (source: string | null) => {
    if (!source) return sourceColors["Manual"];
    return sourceColors[source] || sourceColors["Manual"];
  };

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
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentLeads && recentLeads.length > 0 ? (
          recentLeads.map((lead, index) => (
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
                      {getInitials(lead.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">{lead.email || lead.phone || 'Sem contato'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getSourceColor(lead.source)}>
                    {lead.source || 'Manual'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{getTimeAgo(lead.created_at)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {(lead.funnel_stages as any)?.name || 'Sem etapa'}
                </Badge>
                <div className="flex items-center gap-1">
                  {lead.phone && (
                    <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                      <a href={`tel:${lead.phone}`}>
                        <Phone className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </Button>
                  )}
                  {lead.phone && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8"
                      onClick={() => whatsAppChoice.openDialog(lead.phone!, lead.name || "")}
                    >
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                  {lead.email && (
                    <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                      <a href={`mailto:${lead.email}`}>
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum lead capturado ainda
          </div>
        )}
      </div>

      <WhatsAppChoiceDialog
        open={whatsAppChoice.isOpen}
        onOpenChange={whatsAppChoice.setIsOpen}
        phone={whatsAppChoice.targetPhone}
        contactName={whatsAppChoice.targetName}
      />
    </motion.div>
  );
}
