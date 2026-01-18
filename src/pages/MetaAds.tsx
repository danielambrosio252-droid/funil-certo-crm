import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  DollarSign,
  MousePointer,
  Users,
  MessageCircle,
  TrendingUp,
  RefreshCw,
  Calendar,
  Link,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const performanceData = [
  { date: "01/01", spend: 450, leads: 32, conversas: 28 },
  { date: "02/01", spend: 520, leads: 45, conversas: 38 },
  { date: "03/01", spend: 380, leads: 28, conversas: 22 },
  { date: "04/01", spend: 620, leads: 52, conversas: 45 },
  { date: "05/01", spend: 710, leads: 68, conversas: 58 },
  { date: "06/01", spend: 580, leads: 48, conversas: 42 },
  { date: "07/01", spend: 490, leads: 38, conversas: 32 },
];

const campaigns = [
  { id: 1, name: "Campanha Leads Quentes", status: "active", spend: "R$ 2.450", leads: 145, cpl: "R$ 16,90", ctr: "3.2%", conversas: 89 },
  { id: 2, name: "Remarketing Carrinho", status: "active", spend: "R$ 1.280", leads: 67, cpl: "R$ 19,10", ctr: "4.5%", conversas: 52 },
  { id: 3, name: "Lookalike Compradores", status: "active", spend: "R$ 890", leads: 42, cpl: "R$ 21,19", ctr: "2.8%", conversas: 31 },
  { id: 4, name: "Awareness Marca", status: "paused", spend: "R$ 450", leads: 18, cpl: "R$ 25,00", ctr: "1.9%", conversas: 12 },
  { id: 5, name: "Promoção Black Friday", status: "ended", spend: "R$ 3.200", leads: 210, cpl: "R$ 15,24", ctr: "5.2%", conversas: 156 },
];

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  ended: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  ended: "Finalizada",
};

export default function MetaAds() {
  return (
    <MainLayout title="Meta Ads" subtitle="Métricas e campanhas">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select defaultValue="7d">
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              <SelectItem value="active">Campanhas ativas</SelectItem>
              <SelectItem value="paused">Campanhas pausadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Link className="w-4 h-4" />
            Conectar Conta
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Investimento Total"
          value="R$ 8.270"
          change={15}
          icon={DollarSign}
          variant="default"
        />
        <MetricCard
          title="Leads Captados"
          value="482"
          change={23}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="CTR Médio"
          value="3.52%"
          change={8}
          icon={MousePointer}
          variant="success"
        />
        <MetricCard
          title="Conversas WhatsApp"
          value="340"
          change={31}
          icon={MessageCircle}
          variant="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Investimento x Leads</h3>
            <Badge variant="outline" className="text-success border-success/20 bg-success/10">
              <TrendingUp className="w-3 h-3 mr-1" />
              +18% ROI
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorSpend)"
                  strokeWidth={2}
                  name="Investimento (R$)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Leads x Conversas</h3>
            <Badge variant="outline" className="text-info border-info/20 bg-info/10">
              82% conversão
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="conversas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Conversas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Campaigns Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl"
      >
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-foreground">Campanhas</h3>
          <p className="text-sm text-muted-foreground">Visão detalhada das suas campanhas</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Investimento</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>CPL</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>Conversas</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign, index) => (
              <motion.tr
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[campaign.status]}>
                    {statusLabels[campaign.status]}
                  </Badge>
                </TableCell>
                <TableCell>{campaign.spend}</TableCell>
                <TableCell className="font-medium">{campaign.leads}</TableCell>
                <TableCell>{campaign.cpl}</TableCell>
                <TableCell>{campaign.ctr}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 text-success" />
                    {campaign.conversas}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="w-8 h-8">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </MainLayout>
  );
}
