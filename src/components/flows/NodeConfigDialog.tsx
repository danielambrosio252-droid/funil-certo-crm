import { useState, useEffect, useRef } from "react";
import { Node } from "@xyflow/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariablePicker, DEFAULT_VARIABLES } from "@/components/ui/variable-picker";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Image, Video, Music } from "lucide-react";

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Node | null;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

export function NodeConfigDialog({ open, onOpenChange, node, onSave }: NodeConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const { templates, loading: loadingTemplates, fetchTemplates } = useWhatsAppTemplates();

  useEffect(() => {
    if (open && node?.type === "template") {
      fetchTemplates();
    }
  }, [open, node?.type, fetchTemplates]);

  useEffect(() => {
    if (node?.data?.config) {
      setConfig(node.data.config as Record<string, unknown>);
    } else {
      setConfig({});
    }
  }, [node]);

  const handleSave = () => {
    if (!node) return;
    onSave(node.id, config);
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Configurar {getNodeTitle(node.type as string)}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {node.type === "message" && (
              <MessageConfig config={config} updateConfig={updateConfig} templates={templates} loadingTemplates={loadingTemplates} />
            )}
            {node.type === "template" && (
              <TemplateConfig 
                config={config} 
                updateConfig={updateConfig} 
                templates={templates}
                loading={loadingTemplates}
              />
            )}
            {node.type === "media" && (
              <MediaConfig config={config} updateConfig={updateConfig} />
            )}
            {node.type === "delay" && (
              <DelayConfig config={config} updateConfig={updateConfig} />
            )}
            {node.type === "wait_response" && (
              <WaitResponseConfig config={config} updateConfig={updateConfig} />
            )}
            {node.type === "condition" && (
              <ConditionConfig config={config} updateConfig={updateConfig} />
            )}
            {node.type === "start" && (
              <p className="text-sm text-muted-foreground">
                O bloco de início é configurado nas opções do fluxo (gatilhos).
              </p>
            )}
            {node.type === "end" && (
              <EndConfig config={config} updateConfig={updateConfig} />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageConfig({ 
  config, 
  updateConfig,
  templates,
  loadingTemplates
}: { 
  config: Record<string, unknown>; 
  updateConfig: (key: string, value: unknown) => void;
  templates: any[];
  loadingTemplates: boolean;
}) {
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const useTemplate = config.use_template as boolean;

  return (
    <div className="space-y-4">
      {/* Toggle: Use Template */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Usar Template Meta</p>
          <p className="text-xs text-muted-foreground">Selecionar um template aprovado</p>
        </div>
        <Switch
          checked={useTemplate || false}
          onCheckedChange={(checked) => {
            updateConfig("use_template", checked);
            if (!checked) {
              updateConfig("template_name", undefined);
              updateConfig("template_id", undefined);
              updateConfig("template_language", undefined);
            }
          }}
        />
      </div>

      {useTemplate ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template Aprovado</Label>
            <Select
              value={(config.template_name as string) || ""}
              onValueChange={(value) => {
                const template = approvedTemplates.find((t) => t.name === value);
                updateConfig("template_name", value);
                updateConfig("template_id", template?.id);
                updateConfig("template_language", template?.language);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingTemplates ? "Carregando..." : "Selecione um template"} />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.length === 0 && !loadingTemplates && (
                  <SelectItem value="" disabled>Nenhum template aprovado</SelectItem>
                )}
                {approvedTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.name}>
                    {template.name} ({template.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {config.template_name && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Template: <strong className="text-foreground">{config.template_name as string}</strong>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <VariablePicker
              value={(config.message as string) || ""}
              onChange={(val) => updateConfig("message", val)}
              variables={DEFAULT_VARIABLES}
              placeholder="Digite a mensagem que será enviada..."
              multiline
              rows={4}
            />
          </div>

          {/* Quick Reply Buttons */}
          <div className="space-y-2">
            <Label>Botões de Resposta Rápida (opcional)</Label>
            <ButtonsConfig config={config} updateConfig={updateConfig} />
          </div>
        </div>
      )}
    </div>
  );
}

function ButtonsConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const buttons = (config.buttons as string[]) || [];
  
  const addButton = () => {
    if (buttons.length >= 3) return;
    updateConfig("buttons", [...buttons, ""]);
  };

  const updateButton = (index: number, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = value;
    updateConfig("buttons", newButtons);
  };

  const removeButton = (index: number) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    updateConfig("buttons", newButtons);
  };

  return (
    <div className="space-y-2">
      {buttons.map((btn, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder={`Botão ${index + 1}`}
            value={btn}
            onChange={(e) => updateButton(index, e.target.value)}
            maxLength={20}
          />
          <Button variant="ghost" size="icon" onClick={() => removeButton(index)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      {buttons.length < 3 && (
        <Button variant="outline" size="sm" onClick={addButton} className="w-full">
          + Adicionar Botão
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Máximo 3 botões, 20 caracteres cada</p>
    </div>
  );
}

function TemplateConfig({ 
  config, 
  updateConfig, 
  templates,
  loading 
}: { 
  config: Record<string, unknown>; 
  updateConfig: (key: string, value: unknown) => void;
  templates: any[];
  loading: boolean;
}) {
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const selectedTemplate = approvedTemplates.find((t) => t.name === config.template_name);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Template Aprovado</Label>
        <Select
          value={(config.template_name as string) || ""}
          onValueChange={(value) => {
            const template = approvedTemplates.find((t) => t.name === value);
            updateConfig("template_name", value);
            updateConfig("template_id", template?.id);
            updateConfig("template_language", template?.language);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Carregando..." : "Selecione um template"} />
          </SelectTrigger>
          <SelectContent>
            {approvedTemplates.length === 0 && !loading && (
              <SelectItem value="" disabled>Nenhum template aprovado</SelectItem>
            )}
            {approvedTemplates.map((template) => (
              <SelectItem key={template.id} value={template.name}>
                {template.name} ({template.language})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTemplate && (
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Preview do Template</p>
          {selectedTemplate.components?.map((comp: any, i: number) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium uppercase">{comp.type}: </span>
              {comp.text || (comp.format && `[${comp.format}]`)}
            </div>
          ))}
        </div>
      )}

      {/* Template Variables */}
      {selectedTemplate?.components?.some((c: any) => c.text?.includes("{{")) && (
        <div className="space-y-2">
          <Label>Variáveis do Template</Label>
          <p className="text-xs text-muted-foreground">
            Use {"{nome}"}, {"{email}"}, {"{telefone}"} para dados do lead
          </p>
        </div>
      )}
    </div>
  );
}

function MediaConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mediaType = config.media_type as string;
  const mediaUrl = config.media_url as string;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `flows/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(path);

      updateConfig("media_url", urlData.publicUrl);
      updateConfig("filename", file.name);

      // Auto-detect media type
      if (file.type.startsWith("image/")) {
        updateConfig("media_type", "image");
      } else if (file.type.startsWith("video/")) {
        updateConfig("media_type", "video");
      } else if (file.type.startsWith("audio/")) {
        updateConfig("media_type", "audio");
      } else {
        updateConfig("media_type", "document");
      }

      toast({ title: "Arquivo enviado", description: "Mídia carregada com sucesso." });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erro", description: "Falha no upload do arquivo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case "image": return <Image className="w-8 h-8 text-orange-500" />;
      case "video": return <Video className="w-8 h-8 text-blue-500" />;
      case "audio": return <Music className="w-8 h-8 text-purple-500" />;
      default: return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Mídia</Label>
        <Select
          value={mediaType || ""}
          onValueChange={(value) => updateConfig("media_type", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="document">Documento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Upload Area */}
      <div className="space-y-2">
        <Label>Arquivo</Label>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={
            mediaType === "image" ? "image/*" :
            mediaType === "video" ? "video/*" :
            mediaType === "audio" ? "audio/*" :
            "*"
          }
          onChange={handleFileUpload}
        />
        
        {mediaUrl ? (
          <div className="p-4 border rounded-lg bg-muted/50 flex items-center gap-3">
            {getMediaIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{config.filename as string || "Arquivo"}</p>
              <p className="text-xs text-muted-foreground truncate">{mediaUrl}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                updateConfig("media_url", undefined);
                updateConfig("filename", undefined);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full h-20 flex flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !mediaType}
          >
            <Upload className="w-5 h-5" />
            <span className="text-xs">
              {uploading ? "Enviando..." : !mediaType ? "Selecione o tipo primeiro" : "Clique para enviar arquivo"}
            </span>
          </Button>
        )}
      </div>

      {/* Or URL */}
      <div className="space-y-2">
        <Label>Ou insira a URL</Label>
        <Input
          placeholder="https://exemplo.com/arquivo.jpg"
          value={mediaUrl || ""}
          onChange={(e) => updateConfig("media_url", e.target.value)}
        />
      </div>

      {mediaType === "document" && (
        <div className="space-y-2">
          <Label>Nome do Arquivo</Label>
          <Input
            placeholder="documento.pdf"
            value={(config.filename as string) || ""}
            onChange={(e) => updateConfig("filename", e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Legenda (opcional)</Label>
        <VariablePicker
          value={(config.caption as string) || ""}
          onChange={(val) => updateConfig("caption", val)}
          variables={DEFAULT_VARIABLES}
          placeholder="Legenda da mídia..."
          multiline
          rows={2}
        />
      </div>
    </div>
  );
}

function DelayConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const isSmartDelay = config.smart_delay as boolean;

  return (
    <div className="space-y-4">
      {/* Smart Delay Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Intervalo Inteligente</p>
          <p className="text-xs text-muted-foreground">Varia o tempo para parecer mais humano</p>
        </div>
        <Switch
          checked={isSmartDelay || false}
          onCheckedChange={(checked) => updateConfig("smart_delay", checked)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isSmartDelay ? "Tempo Mínimo" : "Tempo"}</Label>
          <Input
            type="number"
            min={1}
            placeholder="5"
            value={(config.delay_value as number) || ""}
            onChange={(e) => updateConfig("delay_value", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Select
            value={(config.delay_unit as string) || "minutes"}
            onValueChange={(value) => updateConfig("delay_unit", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Segundos</SelectItem>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isSmartDelay && (
        <div className="space-y-2">
          <Label>Tempo Máximo</Label>
          <Input
            type="number"
            min={(config.delay_value as number) || 1}
            placeholder="10"
            value={(config.delay_max as number) || ""}
            onChange={(e) => updateConfig("delay_max", parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            O tempo será aleatório entre o mínimo e máximo
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        O fluxo aguardará este tempo antes de continuar para o próximo bloco.
      </p>
    </div>
  );
}

function WaitResponseConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const hasTimeout = config.has_timeout as boolean;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          O fluxo pausará aqui até o cliente responder uma mensagem.
        </p>
      </div>

      {/* Timeout Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Definir Timeout</p>
          <p className="text-xs text-muted-foreground">Encerrar se não responder no tempo</p>
        </div>
        <Switch
          checked={hasTimeout || false}
          onCheckedChange={(checked) => {
            updateConfig("has_timeout", checked);
            if (!checked) {
              updateConfig("timeout", undefined);
              updateConfig("timeout_unit", undefined);
            }
          }}
        />
      </div>

      {hasTimeout && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tempo</Label>
            <Input
              type="number"
              min={1}
              placeholder="24"
              value={(config.timeout as number) || ""}
              onChange={(e) => updateConfig("timeout", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select
              value={(config.timeout_unit as string) || "hours"}
              onValueChange={(value) => updateConfig("timeout_unit", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Palavras-chave para continuar (opcional)</Label>
        <Input
          placeholder="sim, confirmar, ok"
          value={(config.keywords as string) || ""}
          onChange={(e) => updateConfig("keywords", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Separe por vírgula. Se vazio, qualquer resposta continua o fluxo.
        </p>
      </div>

      {/* Save Response */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Salvar Resposta</p>
          <p className="text-xs text-muted-foreground">Guardar a resposta do cliente</p>
        </div>
        <Switch
          checked={(config.save_response as boolean) || false}
          onCheckedChange={(checked) => updateConfig("save_response", checked)}
        />
      </div>

      {config.save_response && (
        <div className="space-y-2">
          <Label>Nome da Variável</Label>
          <Input
            placeholder="resposta_cliente"
            value={(config.response_variable as string) || ""}
            onChange={(e) => updateConfig("response_variable", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function ConditionConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Campo</Label>
        <Select
          value={(config.field as string) || ""}
          onValueChange={(value) => updateConfig("field", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o campo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_message">Última mensagem</SelectItem>
            <SelectItem value="contact_name">Nome do contato</SelectItem>
            <SelectItem value="tag">Tag do lead</SelectItem>
            <SelectItem value="stage">Etapa do funil</SelectItem>
            <SelectItem value="custom_field">Campo personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.field === "custom_field" && (
        <div className="space-y-2">
          <Label>Nome do Campo</Label>
          <Input
            placeholder="nome_do_campo"
            value={(config.custom_field_name as string) || ""}
            onChange={(e) => updateConfig("custom_field_name", e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Operador</Label>
        <Select
          value={(config.operator as string) || ""}
          onValueChange={(value) => updateConfig("operator", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contém</SelectItem>
            <SelectItem value="not_contains">Não contém</SelectItem>
            <SelectItem value="equals">É igual a</SelectItem>
            <SelectItem value="not_equals">Não é igual a</SelectItem>
            <SelectItem value="starts_with">Começa com</SelectItem>
            <SelectItem value="ends_with">Termina com</SelectItem>
            <SelectItem value="is_empty">Está vazio</SelectItem>
            <SelectItem value="is_not_empty">Não está vazio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!["is_empty", "is_not_empty"].includes(config.operator as string) && (
        <div className="space-y-2">
          <Label>Valor</Label>
          <Input
            placeholder="Digite o valor..."
            value={(config.value as string) || ""}
            onChange={(e) => updateConfig("value", e.target.value)}
          />
        </div>
      )}

      <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
        <p><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-2" /><strong>Verde (Sim)</strong>: Se a condição for verdadeira</p>
        <p><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2" /><strong>Vermelho (Não)</strong>: Se a condição for falsa</p>
      </div>
    </div>
  );
}

function EndConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O bloco de fim encerra o fluxo de automação.
      </p>

      {/* Actions on End */}
      <div className="space-y-3">
        <Label>Ações ao Finalizar</Label>
        
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Adicionar Tag</p>
            <p className="text-xs text-muted-foreground">Marcar o lead ao concluir</p>
          </div>
          <Switch
            checked={(config.add_tag as boolean) || false}
            onCheckedChange={(checked) => updateConfig("add_tag", checked)}
          />
        </div>

        {config.add_tag && (
          <div className="space-y-2">
            <Input
              placeholder="Nome da tag"
              value={(config.tag_name as string) || ""}
              onChange={(e) => updateConfig("tag_name", e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Mover para Etapa</p>
            <p className="text-xs text-muted-foreground">Mudar etapa do funil ao concluir</p>
          </div>
          <Switch
            checked={(config.move_stage as boolean) || false}
            onCheckedChange={(checked) => updateConfig("move_stage", checked)}
          />
        </div>
      </div>
    </div>
  );
}

function getNodeTitle(type: string): string {
  const titles: Record<string, string> = {
    start: "Bloco de Início",
    message: "Mensagem de Texto",
    template: "Template Meta",
    media: "Enviar Mídia",
    delay: "Aguardar Tempo",
    wait_response: "Aguardar Resposta",
    condition: "Condição",
    end: "Bloco de Fim",
  };
  return titles[type] || type;
}
