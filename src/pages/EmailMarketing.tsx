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
  Plus,
  Mail,
  Send,
  Eye,
  MousePointer,
  Users,
  Inbox,
} from "lucide-react";
import { CreateCampaignDialog } from "@/components/email/CreateCampaignDialog";
import { ContactsManager } from "@/components/email/ContactsManager";
import { useEmailContacts } from "@/hooks/useEmailContacts";

export default function EmailMarketing() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");
  const { contacts, subscribedCount } = useEmailContacts();

  const stats = [
    { label: "Total Enviados", value: "0", icon: Send, change: null },
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

          {/* Empty State */}
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
