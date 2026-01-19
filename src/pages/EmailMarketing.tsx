import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Mail,
  Send,
  Eye,
  MousePointer,
  Users,
  Inbox,
  MoreHorizontal,
  Trash2,
  Edit,
  Calendar,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateCampaignDialog } from "@/components/email/CreateCampaignDialog";
import { ContactsManager } from "@/components/email/ContactsManager";
import { useEmailContacts } from "@/hooks/useEmailContacts";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  scheduled: { label: "Agendada", variant: "default" },
  sending: { label: "Enviando", variant: "default" },
  sent: { label: "Enviada", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
};

export default function EmailMarketing() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");
  const { contacts } = useEmailContacts();
  const { campaigns, isLoading, deleteCampaign } = useEmailCampaigns();

  const stats = [
    { label: "Total Enviados", value: String(campaigns.filter(c => c.status === "sent").reduce((acc, c) => acc + c.total_sent, 0)), icon: Send, change: null },
    { label: "Taxa de Abertura", value: "0%", icon: Eye, change: null },
    { label: "Taxa de Cliques", value: "0%", icon: MousePointer, change: null },
    { label: "Contatos", value: String(contacts.length), icon: Users, change: null },
  ];

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
                      {stat.change && (
                        <span className="text-xs text-success font-medium">{stat.change}</span>
                      )}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Mail className="w-4 h-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="w-4 h-4" />
            Contatos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {/* Actions */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Campanhas</h3>
            <Button 
              className="gap-2 gradient-primary text-primary-foreground"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Nova Campanha
            </Button>
          </div>

          {/* Campaigns List or Empty State */}
          {campaigns.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agendamento</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {campaign.campaign_type === "campaign" && "Campanha"}
                            {campaign.campaign_type === "automation" && "Automação"}
                            {campaign.campaign_type === "newsletter" && "Newsletter"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[campaign.status]?.variant || "secondary"}>
                            {statusLabels[campaign.status]?.label || campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {campaign.scheduled_at ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem className="gap-2">
                                <Edit className="w-4 h-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="gap-2 text-destructive"
                                onClick={() => deleteCampaign.mutate(campaign.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nenhuma campanha criada
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Crie sua primeira campanha de e-mail marketing para começar a engajar seus leads e clientes.
                  </p>
                  <Button 
                    className="gap-2 gradient-primary text-primary-foreground"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Criar Primeira Campanha
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsManager />
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </MainLayout>
  );
}
