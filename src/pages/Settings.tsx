import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building,
  Bell,
  Link,
  Shield,
  CreditCard,
  Users,
  Zap,
  Check,
  Webhook,
  MessageCircle,
} from "lucide-react";
import { WhatsAppSetup } from "@/components/whatsapp/WhatsAppSetup";

const integrations = [
  { name: "Meta Ads", description: "Conecte sua conta do Facebook Business", connected: true, icon: "📊" },
  { name: "WhatsApp Business", description: "API oficial do WhatsApp", connected: true, icon: "💬" },
  { name: "Google Analytics", description: "Rastreamento e análises", connected: false, icon: "📈" },
  { name: "Zapier", description: "Automações com 5000+ apps", connected: false, icon: "⚡" },
];

const plans = [
  { name: "Básico", price: "R$ 97", features: ["500 leads/mês", "1 usuário", "WhatsApp básico"], current: false },
  { name: "Pro", price: "R$ 197", features: ["Leads ilimitados", "5 usuários", "WhatsApp + Meta Ads", "Suporte prioritário"], current: true },
  { name: "Enterprise", price: "R$ 497", features: ["Tudo do Pro", "Usuários ilimitados", "API completa", "Gerente dedicado"], current: false },
];

export default function Settings() {
  return (
    <MainLayout title="Configurações" subtitle="Gerencie sua conta e preferências">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building className="w-4 h-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link className="w-4 h-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Equipe</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Plano</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>Atualize suas informações de perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline">Alterar foto</Button>
                    <p className="text-xs text-muted-foreground mt-2">JPG, PNG ou GIF. Max 2MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input defaultValue="João" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sobrenome</Label>
                    <Input defaultValue="Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input defaultValue="joao@empresa.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input defaultValue="(11) 99999-0000" />
                  </div>
                </div>
                <Button className="gradient-primary text-primary-foreground">Salvar Alterações</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Configure como você quer receber alertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Novos leads", description: "Notificar quando um novo lead entrar" },
                  { label: "Mensagens WhatsApp", description: "Alertar sobre novas mensagens" },
                  { label: "Relatórios semanais", description: "Resumo semanal por e-mail" },
                  { label: "Atualizações do sistema", description: "Novidades e melhorias" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader>
                <CardTitle>Dados da Empresa</CardTitle>
                <CardDescription>Informações da sua organização</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input defaultValue="Empresa XYZ Ltda" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input defaultValue="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Endereço</Label>
                    <Input defaultValue="Rua das Empresas, 123 - São Paulo, SP" />
                  </div>
                </div>
                <Button className="gradient-primary text-primary-foreground">Salvar</Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
            <WhatsAppSetup />
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Instruções de Conexão</CardTitle>
                <CardDescription>
                  Seu servidor WhatsApp está rodando em: <code className="bg-muted px-2 py-1 rounded text-sm font-mono">http://72.62.139.222:3001</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">1. Clique em "Configurar" acima</p>
                  <p className="text-sm font-medium">2. Cole a URL do servidor:</p>
                  <code className="block bg-background px-3 py-2 rounded text-sm font-mono">
                    http://72.62.139.222:3001
                  </code>
                  <p className="text-sm font-medium mt-4">3. Clique em "Conectar WhatsApp"</p>
                  <p className="text-sm font-medium">4. Escaneie o QR Code que aparecer</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4">
            {integrations.map((integration) => (
              <Card key={integration.name}>
                <CardContent className="flex items-center justify-between py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                      {integration.icon}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                    </div>
                  </div>
                  {integration.connected ? (
                    <div className="flex items-center gap-3">
                      <Badge className="bg-success/10 text-success border-success/20">
                        <Check className="w-3 h-3 mr-1" />
                        Conectado
                      </Badge>
                      <Button variant="outline" size="sm">Configurar</Button>
                    </div>
                  ) : (
                    <Button size="sm" className="gradient-primary text-primary-foreground">Conectar</Button>
                  )}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardContent className="flex items-center justify-between py-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Webhook className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Webhooks</p>
                    <p className="text-sm text-muted-foreground">Integre com sistemas externos via API</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Configurar</Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Membros da Equipe</CardTitle>
                  <CardDescription>Gerencie os usuários da sua conta</CardDescription>
                </div>
                <Button className="gradient-primary text-primary-foreground">Convidar Membro</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "João Silva", email: "joao@empresa.com", role: "Admin" },
                    { name: "Maria Santos", email: "maria@empresa.com", role: "Vendedor" },
                    { name: "Carlos Oliveira", email: "carlos@empresa.com", role: "Vendedor" },
                  ].map((member) => (
                    <div key={member.email} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{member.role}</Badge>
                        <Button variant="ghost" size="sm">Editar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card key={plan.name} className={plan.current ? "ring-2 ring-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.current && <Badge className="bg-primary text-primary-foreground">Atual</Badge>}
                    </div>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-4 ${plan.current ? "" : "gradient-primary text-primary-foreground"}`}
                      variant={plan.current ? "outline" : "default"}
                      disabled={plan.current}
                    >
                      {plan.current ? "Plano Atual" : "Upgrade"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
