import { motion } from "framer-motion";
import { ArrowRight, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const stageColors: Record<string, string> = {
  0: "bg-info",
  1: "bg-warning",
  2: "bg-primary",
  3: "bg-purple-500",
  4: "bg-success",
  5: "bg-pink-500",
  6: "bg-orange-500",
  7: "bg-teal-500",
};

export function FunnelOverview() {
  const { profile } = useAuth();

  const { data: stagesData, isLoading } = useQuery({
    queryKey: ['funnel-overview', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      // Buscar o funil padrão ou o primeiro funil
      const { data: funnels, error: funnelError } = await supabase
        .from('funnels')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .order('is_default', { ascending: false })
        .order('position', { ascending: true })
        .limit(1);

      if (funnelError || !funnels?.length) return [];

      const funnelId = funnels[0].id;

      // Buscar etapas do funil com contagem de leads
      const { data: stages, error: stagesError } = await supabase
        .from('funnel_stages')
        .select(`
          id,
          name,
          position,
          color,
          funnel_leads (count)
        `)
        .eq('funnel_id', funnelId)
        .eq('company_id', profile.company_id)
        .order('position', { ascending: true });

      if (stagesError) throw stagesError;

      return stages?.map((stage, index) => ({
        name: stage.name,
        count: (stage.funnel_leads as any)?.[0]?.count || 0,
        color: stage.color || stageColors[index % 8] || 'bg-muted',
      })) || [];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000,
  });

  const total = stagesData?.reduce((acc, stage) => acc + stage.count, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Funil de Vendas</h3>
          <p className="text-sm text-muted-foreground">Visão geral das etapas</p>
        </div>
        <Link
          to="/funnels"
          className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
        >
          Ver Kanban
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stagesData && stagesData.length > 0 ? (
        <div className="space-y-4">
          {stagesData.map((stage, index) => {
            const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
            return (
              <div key={stage.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <span className="text-sm font-medium text-foreground">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{stage.count}</span>
                    <span className="text-xs text-muted-foreground">({percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                    className={`h-2 rounded-full ${stage.color}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum funil configurado
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm">Total no funil</span>
        </div>
        <span className="text-lg font-bold text-foreground">{total}</span>
      </div>
    </motion.div>
  );
}
