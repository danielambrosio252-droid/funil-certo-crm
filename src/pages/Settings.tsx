import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building,
  Link,
  CreditCard,
  Users,
  Check,
  Webhook,
  MessageCircle,
  Bell,
  Loader2,
  Upload,
} from "lucide-react";
import { WhatsAppSetup } from "@/components/whatsapp/WhatsAppSetup";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfileSettings } from "@/hooks/useProfileSettings";

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
  const { profile, company } = useAuth();
  const { permission, settings, updateSettings, requestPermission, playNotificationSound } = useNotifications();
  const { 
    uploading, 
    saving, 
    uploadAvatar, 
    saveProfile, 
    getProfileData, 
    getAvatarUrl, 
    getInitials 
  } = useProfileSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Carregar dados do perfil
  useEffect(() => {
    if (profile) {
      const data = getProfileData();
      setFormData(data);
      setAvatarUrl(getAvatarUrl());
    }
  }, [profile, getProfileData, getAvatarUrl]);

  // Handler para upload de arquivo
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const newUrl = await uploadAvatar(file);
    if (newUrl) {
      setAvatarUrl(newUrl);
    }
    
    // Limpar input para permitir re-upload do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handler para salvar perfil
  const handleSaveProfile = async () => {
    await saveProfile(formData);
  };

  // Handler para testar notificação
  const handleTestNotification = async () => {
    if (permission !== "granted") {
      await requestPermission();
    } else {
      playNotificationSound();
      new Notification("🎯 Teste de Notificação", {
        body: "As notificações estão funcionando!",
        icon: "/favicon.ico",
      });
    }
  };

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
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Alterar foto
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">JPG, PNG ou GIF. Max 2MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input 
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sobrenome</Label>
                    <Input 
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input 
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      type="email" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input 
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <Button 
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notificações
                </CardTitle>
                <CardDescription>Configure como você quer receber alertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status da permissão */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">Status das Notificações</p>
                    <p className="text-sm text-muted-foreground">
                      {permission === "granted" 
                        ? "Notificações ativadas no navegador" 
                        : permission === "denied"
                        ? "Notificações bloqueadas - habilite nas configurações do navegador"
                        : "Clique para ativar notificações"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {permission === "granted" ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <Check className="w-3 h-3 mr-1" />
                        Ativado
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={requestPermission} variant="outline">
                        Ativar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={handleTestNotification}>
                      Testar
                    </Button>
                  </div>
                </div>

                {/* Configurações de notificação */}
                {[
                  { 
                    key: "newLeads" as const, 
                    label: "Novos leads", 
                    description: "Notificar quando um novo lead entrar (com som)" 
                  },
                  { 
                    key: "whatsappMessages" as const, 
                    label: "Mensagens WhatsApp", 
                    description: "Alertar sobre novas mensagens" 
                  },
                  { 
                    key: "weeklyReports" as const, 
                    label: "Relatórios semanais", 
                    description: "Resumo semanal por e-mail" 
                  },
                  { 
                    key: "systemUpdates" as const, 
                    label: "Atualizações do sistema", 
                    description: "Novidades e melhorias" 
                  },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch 
                      checked={settings[item.key]}
                      onCheckedChange={(checked) => updateSettings(item.key, checked)}
                    />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input defaultValue={company?.name || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input placeholder="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-2 col-span-1 sm:col-span-2">
                    <Label>Endereço</Label>
                    <Input placeholder="Rua das Empresas, 123 - São Paulo, SP" />
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
                    { name: profile?.full_name || "Você", email: profile?.email || "", role: profile?.role === "owner" ? "Proprietário" : "Admin" },
                  ].map((member) => (
                    <div key={member.email} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
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
