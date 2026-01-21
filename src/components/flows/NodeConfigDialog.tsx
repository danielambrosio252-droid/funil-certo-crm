import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Node | null;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

export function NodeConfigDialog({ open, onOpenChange, node, onSave }: NodeConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const { templates, loading: loadingTemplates } = useWhatsAppTemplates();

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar {getNodeTitle(node.type as string)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {node.type === "message" && (
            <MessageConfig config={config} updateConfig={updateConfig} />
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
            <p className="text-sm text-muted-foreground">
              O bloco de fim encerra o fluxo de automação.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Textarea
          placeholder="Digite a mensagem que será enviada..."
          value={(config.message as string) || ""}
          onChange={(e) => updateConfig("message", e.target.value)}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{nome}"} para incluir o nome do contato
        </p>
      </div>
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
            {approvedTemplates.map((template) => (
              <SelectItem key={template.id} value={template.name}>
                {template.name} ({template.language})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {config.template_name && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            Template selecionado: <strong>{config.template_name as string}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function MediaConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Mídia</Label>
        <Select
          value={(config.media_type as string) || ""}
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
      <div className="space-y-2">
        <Label>URL da Mídia</Label>
        <Input
          placeholder="https://exemplo.com/imagem.jpg"
          value={(config.media_url as string) || ""}
          onChange={(e) => updateConfig("media_url", e.target.value)}
        />
      </div>
      {config.media_type === "document" && (
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
        <Textarea
          placeholder="Legenda da mídia..."
          value={(config.caption as string) || ""}
          onChange={(e) => updateConfig("caption", e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}

function DelayConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tempo</Label>
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
      <p className="text-xs text-muted-foreground">
        O fluxo aguardará este tempo antes de continuar para o próximo bloco.
      </p>
    </div>
  );
}

function WaitResponseConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Timeout (horas)</Label>
        <Input
          type="number"
          min={1}
          placeholder="24"
          value={(config.timeout as number) || ""}
          onChange={(e) => updateConfig("timeout", parseInt(e.target.value) || 0)}
        />
        <p className="text-xs text-muted-foreground">
          Se o cliente não responder nesse tempo, o fluxo será encerrado.
          Deixe vazio para aguardar indefinidamente.
        </p>
      </div>
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
          </SelectContent>
        </Select>
      </div>
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
            <SelectItem value="equals">É igual a</SelectItem>
            <SelectItem value="not_equals">Não é igual a</SelectItem>
            <SelectItem value="starts_with">Começa com</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Valor</Label>
        <Input
          placeholder="Digite o valor..."
          value={(config.value as string) || ""}
          onChange={(e) => updateConfig("value", e.target.value)}
        />
      </div>
      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
        <p><strong>Verde (Sim)</strong>: Se a condição for verdadeira</p>
        <p><strong>Vermelho (Não)</strong>: Se a condição for falsa</p>
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
