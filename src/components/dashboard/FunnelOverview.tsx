import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

const funnelStages = [
  { name: "Novos Leads", count: 145, color: "bg-info" },
  { name: "Qualificação", count: 89, color: "bg-warning" },
  { name: "Proposta", count: 34, color: "bg-primary" },
  { name: "Negociação", count: 18, color: "bg-purple-500" },
  { name: "Fechamento", count: 12, color: "bg-success" },
];

export function FunnelOverview() {
  const total = funnelStages.reduce((acc, stage) => acc + stage.count, 0);

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

      <div className="space-y-4">
        {funnelStages.map((stage, index) => {
          const percentage = Math.round((stage.count / total) * 100);
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
