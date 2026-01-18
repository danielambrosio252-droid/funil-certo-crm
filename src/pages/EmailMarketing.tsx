import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Mail,
  Send,
  Eye,
  MousePointer,
  Users,
  Calendar,
  MoreHorizontal,
  Play,
  Pause,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const campaigns = [
  {
    id: 1,
    name: "Boas-vindas Novos Leads",
    status: "active",
    type: "Automação",
    sent: 1245,
    opened: 892,
    clicked: 234,
    openRate: 71.6,
    clickRate: 18.8,
    lastSent: "Hoje às 14:30",
  },
  {
    id: 2,
    name: "Promoção de Janeiro",
    status: "scheduled",
    type: "Campanha",
    sent: 0,
    opened: 0,
    clicked: 0,
    openRate: 0,
    clickRate: 0,
    scheduledFor: "Amanhã às 10:00",
  },
  {
    id: 3,
    name: "Follow-up Propostas",
    status: "active",
    type: "Automação",
    sent: 456,
    opened: 312,
    clicked: 89,
    openRate: 68.4,
    clickRate: 19.5,
    lastSent: "Ontem às 09:15",
  },
  {
    id: 4,
    name: "Newsletter Semanal",
    status: "draft",
    type: "Newsletter",
    sent: 0,
    opened: 0,
    clicked: 0,
    openRate: 0,
    clickRate: 0,
  },
  {
    id: 5,
    name: "Recuperação de Carrinho",
    status: "paused",
    type: "Automação",
    sent: 234,
    opened: 156,
    clicked: 67,
    openRate: 66.7,
    clickRate: 28.6,
    lastSent: "3 dias atrás",
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "bg-success/10 text-success border-success/20" },
  scheduled: { label: "Agendada", color: "bg-info/10 text-info border-info/20" },
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground border-border" },
  paused: { label: "Pausada", color: "bg-warning/10 text-warning border-warning/20" },
};

const stats = [
  { label: "Total Enviados", value: "12.4K", icon: Send, change: "+8%" },
  { label: "Taxa de Abertura", value: "68.2%", icon: Eye, change: "+3%" },
  { label: "Taxa de Cliques", value: "21.5%", icon: MousePointer, change: "+5%" },
  { label: "Inscritos Ativos", value: "3.2K", icon: Users, change: "+12%" },
];

export default function EmailMarketing() {
  return (
    <MainLayout title="E-mail Marketing" subtitle="Campanhas e automações">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                      <span className="text-xs text-success font-medium">{stat.change}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Campanhas</h3>
        <Button className="gap-2 gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map((campaign, index) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusConfig[campaign.status].color}>
                        {statusConfig[campaign.status].label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{campaign.type}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      {campaign.status === "active" ? (
                        <DropdownMenuItem>
                          <Pause className="w-4 h-4 mr-2" /> Pausar
                        </DropdownMenuItem>
                      ) : campaign.status === "paused" ? (
                        <DropdownMenuItem>
                          <Play className="w-4 h-4 mr-2" /> Ativar
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {campaign.sent > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{campaign.sent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{campaign.openRate}%</p>
                        <p className="text-xs text-muted-foreground">Abertura</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{campaign.clickRate}%</p>
                        <p className="text-xs text-muted-foreground">Cliques</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de abertura</span>
                        <span className="font-medium">{campaign.openRate}%</span>
                      </div>
                      <Progress value={campaign.openRate} className="h-2" />
                    </div>
                    {campaign.lastSent && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Último envio: {campaign.lastSent}
                      </p>
                    )}
                  </div>
                ) : campaign.status === "scheduled" ? (
                  <div className="py-4 text-center">
                    <Calendar className="w-8 h-8 mx-auto text-info mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Agendada para {campaign.scheduledFor}
                    </p>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <Pencil className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Rascunho em edição
                    </p>
                    <Button variant="outline" size="sm" className="mt-3">
                      Continuar editando
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </MainLayout>
  );
}
