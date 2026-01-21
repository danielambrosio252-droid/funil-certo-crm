import { useState, useEffect } from "react";
import { useWhatsAppTemplates, WhatsAppTemplate, TemplateComponent } from "@/hooks/useWhatsAppTemplates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  Clock, 
  XCircle, 
  PauseCircle,
  AlertTriangle,
  FileText,
  MessageSquare
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVED: { label: "Aprovado", color: "bg-emerald-500", icon: <CheckCircle className="w-4 h-4" /> },
  PENDING: { label: "Pendente", color: "bg-amber-500", icon: <Clock className="w-4 h-4" /> },
  REJECTED: { label: "Rejeitado", color: "bg-red-500", icon: <XCircle className="w-4 h-4" /> },
  PAUSED: { label: "Pausado", color: "bg-slate-500", icon: <PauseCircle className="w-4 h-4" /> },
  DISABLED: { label: "Desativado", color: "bg-slate-400", icon: <AlertTriangle className="w-4 h-4" /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilitário",
  AUTHENTICATION: "Autenticação",
};

const LANGUAGE_OPTIONS = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Español" },
];

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    name: string,
    language: string,
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION",
    components: TemplateComponent[]
  ) => Promise<void>;
  loading: boolean;
}

function CreateTemplateDialog({ open, onOpenChange, onSubmit, loading }: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !bodyText.trim()) return;

    const components: TemplateComponent[] = [];

    if (headerText.trim()) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText.trim(),
      });
    }

    components.push({
      type: "BODY",
      text: bodyText.trim(),
    });

    if (footerText.trim()) {
      components.push({
        type: "FOOTER",
        text: footerText.trim(),
      });
    }

    await onSubmit(
      name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      language,
      category,
      components
    );

    // Reset form
    setName("");
    setBodyText("");
    setHeaderText("");
    setFooterText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            Criar Novo Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Template *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: confirmacao_pedido"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Apenas letras minúsculas, números e underscore (_)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utilitário</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="header">Cabeçalho (opcional)</Label>
            <Input
              id="header"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Título da mensagem"
              className="mt-1"
              maxLength={60}
            />
          </div>

          <div>
            <Label htmlFor="body">Corpo da Mensagem *</Label>
            <Textarea
              id="body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Olá {{1}}! Seu pedido {{2}} foi confirmado."
              className="mt-1 min-h-[100px]"
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas
            </p>
          </div>

          <div>
            <Label htmlFor="footer">Rodapé (opcional)</Label>
            <Input
              id="footer"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Obrigado por escolher nossa empresa"
              className="mt-1"
              maxLength={60}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !name.trim() || !bodyText.trim()}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {loading ? "Criando..." : "Enviar para Análise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  template: WhatsAppTemplate;
  onDelete: (name: string) => void;
  onSelect?: (template: WhatsAppTemplate) => void;
}

function TemplateCard({ template, onDelete, onSelect }: TemplateCardProps) {
  const status = STATUS_CONFIG[template.status] || STATUS_CONFIG.PENDING;
  const bodyComponent = template.components?.find((c) => c.type === "BODY");
  const headerComponent = template.components?.find((c) => c.type === "HEADER");

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {template.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {CATEGORY_LABELS[template.category] || template.category}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {template.language}
              </Badge>
            </div>
          </div>
          <Badge className={`${status.color} text-white flex items-center gap-1`}>
            {status.icon}
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {headerComponent?.text && (
          <p className="text-sm font-medium text-foreground mb-1">
            {headerComponent.text}
          </p>
        )}
        {bodyComponent?.text && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {bodyComponent.text}
          </p>
        )}
        
        {template.rejected_reason && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs text-red-600 dark:text-red-400">
            <strong>Motivo:</strong> {template.rejected_reason}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          {template.status === "APPROVED" && onSelect && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelect(template)}
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Usar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(template.name)}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface WhatsAppTemplatesProps {
  onSelectTemplate?: (template: WhatsAppTemplate) => void;
}

export function WhatsAppTemplates({ onSelectTemplate }: WhatsAppTemplatesProps) {
  const { templates, loading, fetchTemplates, createTemplate, deleteTemplate } = useWhatsAppTemplates();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async (
    name: string,
    language: string,
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION",
    components: TemplateComponent[]
  ) => {
    await createTemplate(name, language, category, components);
  };

  const filteredTemplates = statusFilter === "all" 
    ? templates 
    : templates.filter((t) => t.status === statusFilter);

  const approvedCount = templates.filter((t) => t.status === "APPROVED").length;
  const pendingCount = templates.filter((t) => t.status === "PENDING").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Templates de Mensagem</h3>
          <p className="text-sm text-muted-foreground">
            {approvedCount} aprovados • {pendingCount} pendentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTemplates()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({templates.length})</TabsTrigger>
          <TabsTrigger value="APPROVED">Aprovados ({approvedCount})</TabsTrigger>
          <TabsTrigger value="PENDING">Pendentes ({pendingCount})</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejeitados</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      <ScrollArea className="flex-1">
        {loading && templates.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {statusFilter === "all"
                ? "Nenhum template encontrado"
                : `Nenhum template ${STATUS_CONFIG[statusFilter]?.label.toLowerCase() || statusFilter}`}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Criar primeiro template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={`${template.name}-${template.language}`}
                template={template}
                onDelete={deleteTemplate}
                onSelect={onSelectTemplate}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create Dialog */}
      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
        loading={loading}
      />
    </div>
  );
}
