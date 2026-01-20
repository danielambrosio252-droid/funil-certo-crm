import { motion } from "framer-motion";
import { MousePointer, DollarSign, Users, MessageCircle, Eye, RefreshCcw } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface AdsMetricsCardProps {
  metrics: DashboardMetrics;
}

export function AdsMetricsCard({ metrics }: AdsMetricsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const adsMetrics = [
    { 
      label: "CPC", 
      value: formatCurrency(metrics.cpc), 
      icon: MousePointer, 
      description: "Custo por Clique",
      color: "text-blue-500"
    },
    { 
      label: "CPM", 
      value: formatCurrency(metrics.cpm), 
      icon: Eye, 
      description: "Custo por Mil Impressões",
      color: "text-purple-500"
    },
    { 
      label: "CTR", 
      value: formatPercent(metrics.ctr), 
      icon: MousePointer, 
      description: "Taxa de Cliques",
      color: "text-green-500"
    },
    { 
      label: "CPL", 
      value: formatCurrency(metrics.cpl), 
      icon: Users, 
      description: "Custo por Lead",
      color: "text-orange-500"
    },
    { 
      label: "Custo/Conversa", 
      value: formatCurrency(metrics.cplConversation), 
      icon: MessageCircle, 
      description: "Custo por Conversa",
      color: "text-teal-500"
    },
    { 
      label: "Reentradas", 
      value: formatNumber(metrics.reentryLeads), 
      icon: RefreshCcw, 
      description: "Leads de Reentrada",
      color: "text-pink-500",
      change: metrics.reentryChange
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Métricas de Performance</h3>
          <p className="text-sm text-muted-foreground">Dados da semana atual</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Investimento: <span className="font-semibold text-foreground">{formatCurrency(metrics.totalSpend)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {adsMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            className="bg-muted/50 rounded-lg p-4 flex flex-col items-center text-center"
          >
            <div className={`p-2 rounded-lg bg-background mb-2 ${metric.color}`}>
              <metric.icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
            <span className="font-bold text-foreground text-lg">{metric.value}</span>
            {metric.change !== undefined && (
              <span className={`text-xs mt-1 ${metric.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                {metric.change >= 0 ? '+' : ''}{metric.change}%
              </span>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">{metric.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Cliques</p>
            <p className="font-semibold text-foreground">{formatNumber(metrics.totalClicks)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliques no Link</p>
            <p className="font-semibold text-foreground">{formatNumber(metrics.totalLinkClicks)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Impressões</p>
            <p className="font-semibold text-foreground">{formatNumber(metrics.totalImpressions)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}