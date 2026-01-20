import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Cloud, 
  Check, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Shield,
  Key,
  Phone,
  Building2,
  Copy,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CloudApiConfig {
  whatsapp_mode: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_waba_id: string | null;
}

export function WhatsAppCloudSetup() {
  const { company, refetchProfile } = useAuth();
  const { toast } = useToast();

  const [config, setConfig] = useState<CloudApiConfig>({
    whatsapp_mode: "baileys",
    whatsapp_phone_number_id: null,
    whatsapp_waba_id: null,
  });
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // Webhook URL for Meta
  const webhookUrl = `https://ysiszrxwbargoyqrrehr.supabase.co/functions/v1/whatsapp-cloud-webhook`;

  useEffect(() => {
    if (company?.id) {
      fetchConfig();
      checkToken();
    }
  }, [company?.id]);

  const fetchConfig = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("whatsapp_mode, whatsapp_phone_number_id, whatsapp_waba_id")
        .eq("id", company.id)
        .single();

      if (error) throw error;

      if (data) {
        setConfig({
          whatsapp_mode: data.whatsapp_mode || "baileys",
          whatsapp_phone_number_id: data.whatsapp_phone_number_id,
          whatsapp_waba_id: data.whatsapp_waba_id,
        });
        setPhoneNumberId(data.whatsapp_phone_number_id || "");
        setWabaId(data.whatsapp_waba_id || "");
      }
    } catch (err) {
      console.error("Erro ao buscar configuração:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-cloud-send", {
        body: { action: "check_token" },
      });
      
      setHasToken(data?.has_token || false);
    } catch {
      setHasToken(false);
    }
  };

  const handleSave = async () => {
    if (!company?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          whatsapp_mode: "cloud_api",
          whatsapp_phone_number_id: phoneNumberId || null,
          whatsapp_waba_id: wabaId || null,
        })
        .eq("id", company.id);

      if (error) throw error;

      setConfig({
        whatsapp_mode: "cloud_api",
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_waba_id: wabaId,
      });

      await refetchProfile();

      toast({
        title: "Configuração salva!",
        description: "API do WhatsApp Business configurada com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!phoneNumberId) {
      toast({
        title: "Erro",
        description: "Informe o Phone Number ID antes de testar.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-cloud-send", {
        body: { action: "test" },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Conexão OK!",
          description: "A API do WhatsApp Business está funcionando.",
        });
      } else {
        toast({
          title: "Erro na conexão",
          description: data?.error || "Verifique suas credenciais.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Erro ao testar:", err);
      toast({
        title: "Erro",
        description: "Não foi possível testar a conexão.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência.",
    });
  };

  const isConfigured = config.whatsapp_mode === "cloud_api" && config.whatsapp_phone_number_id;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <motion.div 
        className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
          isConfigured 
            ? "bg-emerald-50 border-emerald-200" 
            : "bg-slate-50 border-slate-200"
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm ${
          isConfigured ? "text-emerald-600" : "text-slate-500"
        }`}>
          {isConfigured ? <Check className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isConfigured ? "text-emerald-600" : "text-slate-600"}`}>
              {isConfigured ? "API Configurada" : "Não Configurado"}
            </span>
            {isConfigured && (
              <Badge variant="secondary" className="font-mono text-xs">
                {config.whatsapp_phone_number_id}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConfigured 
              ? "WhatsApp Business API oficial da Meta" 
              : "Configure seus tokens da Meta para usar a API oficial"
            }
          </p>
        </div>
      </motion.div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Credenciais da API
          </CardTitle>
          <CardDescription>
            Insira as credenciais obtidas no Meta for Developers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone_number_id" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number ID
            </Label>
            <Input
              id="phone_number_id"
              placeholder="Ex: 123456789012345"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: WhatsApp &gt; API Setup &gt; Phone Number ID
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waba_id" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              WhatsApp Business Account ID (WABA ID)
            </Label>
            <Input
              id="waba_id"
              placeholder="Ex: 987654321098765"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: WhatsApp &gt; API Setup &gt; WhatsApp Business Account ID
            </p>
          </div>

          {/* Token Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${hasToken ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {hasToken ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">Access Token configurado</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  Access Token não configurado. Solicite ao administrador.
                </span>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !phoneNumberId} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !phoneNumberId}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="w-4 h-4" />
            URL do Webhook (para Meta)
          </CardTitle>
          <CardDescription>
            Configure esta URL no Meta for Developers para receber mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-lg text-xs font-mono break-all">
              {webhookUrl}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="help">
          <AccordionTrigger className="text-sm">
            Como obter as credenciais da Meta?
          </AccordionTrigger>
          <AccordionContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 1: Acesse o Meta for Developers</p>
              <p>
                Vá para{" "}
                <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  developers.facebook.com
                </a>
                {" "}e faça login com sua conta do Facebook.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 2: Crie ou selecione um App</p>
              <p>
                Crie um novo app do tipo "Business" ou selecione um existente. 
                Adicione o produto "WhatsApp" ao seu app.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 3: Obtenha o Phone Number ID</p>
              <p>
                Em WhatsApp &gt; API Setup, você verá o "Phone Number ID" abaixo do número de teste.
                Copie esse ID e cole no campo acima.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 4: Obtenha o WABA ID</p>
              <p>
                Na mesma página, você encontrará o "WhatsApp Business Account ID".
                Copie e cole no campo correspondente.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 5: Gerar Token Permanente</p>
              <p>
                Crie um System User em Business Settings &gt; System Users.
                Gere um token com as permissões: <code className="bg-muted px-1 rounded">whatsapp_business_messaging</code> e <code className="bg-muted px-1 rounded">whatsapp_business_management</code>.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Passo 6: Configurar Webhook</p>
              <p>
                Em WhatsApp &gt; Configuration &gt; Webhook, adicione a URL do webhook acima.
                Use qualquer token de verificação (será validado na primeira chamada).
                Inscreva-se nos eventos: <code className="bg-muted px-1 rounded">messages</code>.
              </p>
            </div>

            <Button variant="outline" className="w-full mt-2" asChild>
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Documentação Oficial da Meta
              </a>
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
