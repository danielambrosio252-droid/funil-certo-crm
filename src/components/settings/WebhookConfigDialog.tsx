import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, RefreshCw, Check, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFunnels } from "@/hooks/useFunnels";
import { toast } from "sonner";

interface WebhookConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WebhookConfig {
  id: string;
  company_id: string;
  webhook_secret: string;
  default_funnel_id: string | null;
  default_stage_id: string | null;
  is_active: boolean;
}

export function WebhookConfigDialog({ open, onOpenChange }: WebhookConfigDialogProps) {
  const { profile } = useAuth();
  const { funnels } = useFunnels();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-webhook`;

  // Carregar config
  useEffect(() => {
    if (open && profile?.company_id) {
      loadConfig();
    }
  }, [open, profile?.company_id]);

  // Carregar estágios quando mudar o funil
  useEffect(() => {
    if (config?.default_funnel_id) {
      loadStages(config.default_funnel_id);
    } else {
      setStages([]);
    }
  }, [config?.default_funnel_id]);

  const loadConfig = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_configs")
        .select("*")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as WebhookConfig);
      } else {
        // Criar config padrão
        const { data: newConfig, error: createError } = await supabase
          .from("webhook_configs")
          .insert({ company_id: profile.company_id })
          .select()
          .single();

        if (createError) throw createError;
        setConfig(newConfig as WebhookConfig);
      }
    } catch (error) {
      console.error("Error loading webhook config:", error);
      toast.error("Erro ao carregar configuração do webhook");
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (funnelId: string) => {
    const { data, error } = await supabase
      .from("funnel_stages")
      .select("id, name")
      .eq("funnel_id", funnelId)
      .order("position");

    if (!error && data) {
      setStages(data);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("webhook_configs")
        .update({
          default_funnel_id: config.default_funnel_id,
          default_stage_id: config.default_stage_id,
          is_active: config.is_active,
        })
        .eq("id", config.id);

      if (error) throw error;
      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const regenerateSecret = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Gerar novo secret
      const newSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      
      const { error } = await supabase
        .from("webhook_configs")
        .update({ webhook_secret: newSecret })
        .eq("id", config.id);

      if (error) throw error;
      
      setConfig({ ...config, webhook_secret: newSecret });
      toast.success("Token regenerado com sucesso!");
    } catch (error) {
      console.error("Error regenerating secret:", error);
      toast.error("Erro ao regenerar token");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração de Webhook</DialogTitle>
          <DialogDescription>
            Configure o webhook para receber leads de formulários externos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Webhook Ativo</p>
              <p className="text-sm text-muted-foreground">Receber leads via API</p>
            </div>
            <Switch
              checked={config?.is_active ?? true}
              onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, is_active: checked } : null)}
            />
          </div>

          {/* URL do Webhook */}
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "url")}
              >
                {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Token de Autenticação */}
          <div className="space-y-2">
            <Label>Token de Autenticação (X-Webhook-Secret)</Label>
            <div className="flex gap-2">
              <Input
                value={config?.webhook_secret || ""}
                readOnly
                type="password"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(config?.webhook_secret || "", "secret")}
              >
                {copied === "secret" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={regenerateSecret}
                disabled={saving}
              >
                <RefreshCw className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Regenerar o token invalidará integrações existentes
            </p>
          </div>

          {/* Funil Padrão */}
          <div className="space-y-2">
            <Label>Funil Padrão</Label>
            <Select
              value={config?.default_funnel_id || ""}
              onValueChange={(value) => setConfig(prev => prev ? { 
                ...prev, 
                default_funnel_id: value || null,
                default_stage_id: null 
              } : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {funnels?.map((funnel) => (
                  <SelectItem key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estágio Padrão */}
          {config?.default_funnel_id && stages.length > 0 && (
            <div className="space-y-2">
              <Label>Estágio Padrão</Label>
              <Select
                value={config?.default_stage_id || ""}
                onValueChange={(value) => setConfig(prev => prev ? { 
                  ...prev, 
                  default_stage_id: value || null 
                } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Primeiro estágio do funil" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Documentação */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                📋 Campos do Payload
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">name</code>
                  <span className="text-muted-foreground">Nome do lead</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">email</code>
                  <span className="text-muted-foreground">E-mail</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">phone</code>
                  <span className="text-muted-foreground">Telefone</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">value</code>
                  <span className="text-muted-foreground">Valor potencial (número)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">source</code>
                  <span className="text-muted-foreground">Origem (ex: "Facebook")</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">tags</code>
                  <span className="text-muted-foreground">Array de tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">notes</code>
                  <span className="text-muted-foreground">Observações</span>
                </div>
              </div>

              {/* Campos Personalizados */}
              <h4 className="font-medium mt-6 mb-3 flex items-center gap-2">
                🎨 Campos Personalizados
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Qualquer campo adicional enviado no payload será automaticamente salvo como campo personalizado 
                e aparecerá na aba "Formulário" do lead.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">empresa</code>
                  <span className="text-muted-foreground">Nome da empresa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">tipo_negocio</code>
                  <span className="text-muted-foreground">Tipo de negócio</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">objetivo_principal</code>
                  <span className="text-muted-foreground">Objetivo do cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">desafio_atual</code>
                  <span className="text-muted-foreground">Desafio/problema atual</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">investe_anuncios</code>
                  <span className="text-muted-foreground">Se já investe em anúncios</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">investimento_mensal</code>
                  <span className="text-muted-foreground">Valor investido por mês</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">prazo_comecar</code>
                  <span className="text-muted-foreground">Prazo para começar</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">instagram</code>
                  <span className="text-muted-foreground">Perfil do Instagram</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">Flexível</Badge>
                  <code className="bg-muted px-2 py-0.5 rounded">orcamento_aprovado</code>
                  <span className="text-muted-foreground">Se aceita o orçamento</span>
                </div>
              </div>

              <h4 className="font-medium mt-6 mb-3 flex items-center gap-2">
                💡 Exemplo Básico
              </h4>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: SEU_TOKEN_AQUI" \\
  -d '{
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "value": 1500,
    "source": "Facebook Ads",
    "tags": ["interessado", "facebook"]
  }'`}
              </pre>

              <h4 className="font-medium mt-6 mb-3 flex items-center gap-2">
                📝 Exemplo com Campos Personalizados
              </h4>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: SEU_TOKEN_AQUI" \\
  -d '{
    "name": "Maria Souza",
    "email": "maria@empresa.com",
    "phone": "11988887777",
    "source": "Landing Page",
    "empresa": "Empresa XYZ",
    "tipo_negocio": "E-commerce",
    "objetivo_principal": "Aumentar vendas online",
    "desafio_atual": "Baixo tráfego no site",
    "investe_anuncios": "Sim",
    "investimento_mensal": "R$ 2.000",
    "prazo_comecar": "Próximas 2 semanas",
    "instagram": "@empresaxyz",
    "orcamento_aprovado": "Sim, dentro da realidade"
  }'`}
              </pre>

              <p className="text-xs text-muted-foreground mt-3 p-2 bg-primary/5 rounded">
                💡 <strong>Dica:</strong> Os campos personalizados aparecerão na aba "Formulário" 
                quando você abrir os detalhes do lead. Use nomes de campos descritivos para facilitar a leitura.
              </p>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Configuração
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
