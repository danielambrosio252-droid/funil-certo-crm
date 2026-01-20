import { motion } from "framer-motion";
import { TrendingUp, MousePointer, DollarSign, Users } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyData, DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface MetaAdsChartProps {
  dailyData: DailyData[];
  metrics?: DashboardMetrics;
}

export function MetaAdsChart({ dailyData, metrics: dashMetrics }: MetaAdsChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const chartData = dailyData.length > 0 ? dailyData.map(d => ({
    name: d.day,
    leads: d.leads,
    conversas: d.conversas,
    custo: d.spend,
  })) : [
    { name: "Seg", leads: 0, conversas: 0, custo: 0 },
    { name: "Ter", leads: 0, conversas: 0, custo: 0 },
    { name: "Qua", leads: 0, conversas: 0, custo: 0 },
    { name: "Qui", leads: 0, conversas: 0, custo: 0 },
    { name: "Sex", leads: 0, conversas: 0, custo: 0 },
    { name: "Sáb", leads: 0, conversas: 0, custo: 0 },
    { name: "Dom", leads: 0, conversas: 0, custo: 0 },
  ];

  const totalLeadsWeek = chartData.reduce((sum, d) => sum + d.leads, 0);
  const totalConversasWeek = chartData.reduce((sum, d) => sum + d.conversas, 0);

  const metricsData = [
    { 
      label: "CTR", 
      value: dashMetrics ? `${dashMetrics.ctr.toFixed(2)}%` : "0%", 
      icon: MousePointer, 
      change: dashMetrics && dashMetrics.ctr > 0 ? "+ativo" : "—" 
    },
    { 
      label: "CPL", 
      value: dashMetrics ? formatCurrency(dashMetrics.cpl) : "R$ 0", 
      icon: DollarSign, 
      change: dashMetrics && dashMetrics.cpl > 0 ? "ativo" : "—" 
    },
    { 
      label: "Conversões", 
      value: String(totalConversasWeek), 
      icon: Users, 
      change: dashMetrics ? `${dashMetrics.conversasChange >= 0 ? '+' : ''}${dashMetrics.conversasChange}%` : "—" 
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Leads x Conversas</h3>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
        </div>
        {dashMetrics && dashMetrics.leadsChange !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${dashMetrics.leadsChange >= 0 ? 'text-success' : 'text-destructive'}`}>
            <TrendingUp className="w-4 h-4" />
            {dashMetrics.leadsChange >= 0 ? '+' : ''}{dashMetrics.leadsChange}% vs semana anterior
          </div>
        )}
      </div>

      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorConversas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="hsl(217, 91%, 60%)"
              fillOpacity={1}
              fill="url(#colorLeads)"
              strokeWidth={2}
              name="Leads"
            />
            <Area
              type="monotone"
              dataKey="conversas"
              stroke="hsl(142, 76%, 36%)"
              fillOpacity={1}
              fill="url(#colorConversas)"
              strokeWidth={2}
              name="Conversas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {metricsData.map((metric) => (
          <div
            key={metric.label}
            className="bg-muted/50 rounded-lg p-3 flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <metric.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{metric.value}</span>
                <span className="text-xs text-success">{metric.change}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
