import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Calendar, Download, TrendingUp, Users, DollarSign, Target } from "lucide-react";

const monthlyData = [
  { month: "Jan", leads: 245, conversoes: 48, receita: 48000 },
  { month: "Fev", leads: 312, conversoes: 62, receita: 62000 },
  { month: "Mar", leads: 287, conversoes: 54, receita: 54000 },
  { month: "Abr", leads: 398, conversoes: 78, receita: 78000 },
  { month: "Mai", leads: 452, conversoes: 92, receita: 92000 },
  { month: "Jun", leads: 521, conversoes: 105, receita: 105000 },
];

const sourceData = [
  { name: "Meta Ads", value: 45, color: "hsl(199, 89%, 48%)" },
  { name: "WhatsApp", value: 30, color: "hsl(142, 76%, 36%)" },
  { name: "Formulário", value: 15, color: "hsl(38, 92%, 50%)" },
  { name: "Indicação", value: 10, color: "hsl(271, 91%, 65%)" },
];

const conversionData = [
  { stage: "Leads", value: 1000, rate: 100 },
  { stage: "Qualificados", value: 650, rate: 65 },
  { stage: "Propostas", value: 280, rate: 28 },
  { stage: "Negociação", value: 150, rate: 15 },
  { stage: "Fechados", value: 85, rate: 8.5 },
];

export default function Reports() {
  return (
    <MainLayout title="Relatórios" subtitle="Análises e métricas detalhadas">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Select defaultValue="6m">
            <SelectTrigger className="w-48">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { title: "Total Leads", value: "2.215", icon: Users, change: "+18%", color: "text-primary" },
          { title: "Conversões", value: "439", icon: Target, change: "+24%", color: "text-success" },
          { title: "Receita Total", value: "R$ 439K", icon: DollarSign, change: "+32%", color: "text-warning" },
          { title: "Taxa Conversão", value: "19.8%", icon: TrendingUp, change: "+5%", color: "text-info" },
        ].map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                    <p className="text-xs text-success mt-1">{card.change} vs período anterior</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-muted ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Performance Mensal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Performance Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Leads" />
                    <Bar dataKey="conversoes" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Conversões" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Origem dos Leads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Origem dos Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                      labelLine={false}
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {sourceData.map((source) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-sm text-muted-foreground">{source.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Funnel de Conversão */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversionData.map((stage, index) => {
                const width = `${stage.rate}%`;
                const isLast = index === conversionData.length - 1;
                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{stage.value}</span>
                        <span className="text-xs text-muted-foreground">({stage.rate}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-8 relative overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                        className={`h-8 rounded-full flex items-center justify-end pr-3 ${
                          isLast ? "bg-success" : "bg-primary"
                        }`}
                      >
                        {stage.rate >= 20 && (
                          <span className="text-xs font-medium text-primary-foreground">
                            {stage.rate}%
                          </span>
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
}
