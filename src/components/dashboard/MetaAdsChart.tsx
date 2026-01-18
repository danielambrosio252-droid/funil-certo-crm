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

const data = [
  { name: "Seg", leads: 24, conversas: 45, custo: 120 },
  { name: "Ter", leads: 32, conversas: 52, custo: 145 },
  { name: "Qua", leads: 28, conversas: 48, custo: 132 },
  { name: "Qui", leads: 45, conversas: 67, custo: 198 },
  { name: "Sex", leads: 52, conversas: 78, custo: 215 },
  { name: "Sáb", leads: 38, conversas: 56, custo: 165 },
  { name: "Dom", leads: 22, conversas: 35, custo: 98 },
];

const metrics = [
  { label: "CTR", value: "3.2%", icon: MousePointer, change: "+0.5%" },
  { label: "CPL", value: "R$ 8,45", icon: DollarSign, change: "-12%" },
  { label: "Conversões", value: "89", icon: Users, change: "+18%" },
];

export function MetaAdsChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Meta Ads Performance</h3>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
        </div>
        <div className="flex items-center gap-1 text-success text-sm font-medium">
          <TrendingUp className="w-4 h-4" />
          +23% vs semana anterior
        </div>
      </div>

      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
            />
            <Area
              type="monotone"
              dataKey="conversas"
              stroke="hsl(142, 76%, 36%)"
              fillOpacity={1}
              fill="url(#colorConversas)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => (
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
