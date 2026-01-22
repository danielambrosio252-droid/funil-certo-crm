import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Mail,
  MessageCircle,
  Edit2,
  Save,
  X,
  Plus,
  Clock,
  DollarSign,
  Tag,
  User,
  FileText,
  History,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { FunnelLead, useFunnelLeads } from "@/hooks/useFunnels";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppChoiceDialog, useWhatsAppChoice } from "@/components/whatsapp/WhatsAppChoiceDialog";

const SOURCES = [
  "Meta Ads",
  "WhatsApp",
  "Formulário",
  "Indicação",
  "LinkedIn",
  "Google Ads",
  "Orgânico",
  "Outro",
];

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info border-info/20",
  "WhatsApp": "bg-success/10 text-success border-success/20",
  "Formulário": "bg-warning/10 text-warning border-warning/20",
  "Indicação": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "LinkedIn": "bg-blue-600/10 text-blue-600 border-blue-600/20",
  "Google Ads": "bg-red-500/10 text-red-500 border-red-500/20",
  "Orgânico": "bg-green-600/10 text-green-600 border-green-600/20",
  "Outro": "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

interface LeadDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: FunnelLead | null;
  stageIds: string[];
  stageName?: string;
  funnelId?: string | null;
}

export function LeadDetailsDialog({
  open,
  onOpenChange,
  lead,
  stageIds,
  stageName,
  funnelId,
}: LeadDetailsDialogProps) {
  const { updateLead, deleteLead } = useFunnelLeads(stageIds, funnelId);
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const whatsAppChoice = useWhatsAppChoice();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    value: "",
    source: "",
    notes: "",
    tags: [] as string[],
  });

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        value: lead.value?.toString() || "",
        source: lead.source || "",
        notes: lead.notes || "",
        tags: lead.tags || [],
      });
      setIsEditing(false);
    }
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      previousLead: lead, // Pass previous lead for automation comparison
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      value: formData.value ? parseFloat(formData.value) : 0,
      source: formData.source || null,
      notes: formData.notes || null,
      tags: formData.tags,
      last_contact_at: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const updatedNotes = formData.notes
      ? `${formData.notes}\n\n[${timestamp}]\n${newNote}`
      : `[${timestamp}]\n${newNote}`;
    
    await updateLead.mutateAsync({
      id: lead.id,
      previousLead: lead, // Pass previous lead for automation comparison
      notes: updatedNotes,
      last_contact_at: new Date().toISOString(),
    });
    
    setFormData((prev) => ({ ...prev, notes: updatedNotes }));
    setNewNote("");
  };

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id);
    onOpenChange(false);
  };

  // Parse notes into entries
  const noteEntries = formData.notes
    ? formData.notes.split(/\n\n(?=\[)/).filter(Boolean)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {lead.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{lead.name}</DialogTitle>
                {stageName && (
                  <p className="text-sm text-muted-foreground">
                    Etapa: {stageName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateLead.isPending}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Salvar
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="info" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Informações</span>
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Formulário</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Notas</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* Info Tab */}
            <TabsContent value="info" className="mt-0 space-y-6">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {(formData.phone || lead.phone) && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${formData.phone || lead.phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Ligar
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => whatsAppChoice.openDialog(
                        formData.phone || lead.phone || "",
                        formData.name || lead.name
                      )}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </>
                )}
                {(formData.email || lead.email) && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${formData.email || lead.email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      E-mail
                    </a>
                  </Button>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead-name">Nome</Label>
                    {isEditing ? (
                      <Input
                        id="lead-name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    ) : (
                      <p className="text-sm py-2">{formData.name || "-"}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-email">E-mail</Label>
                    {isEditing ? (
                      <Input
                        id="lead-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    ) : (
                      <p className="text-sm py-2">{formData.email || "-"}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead-phone">Telefone</Label>
                    {isEditing ? (
                      <Input
                        id="lead-phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    ) : (
                      <p className="text-sm py-2">{formData.phone || "-"}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-value">Valor (R$)</Label>
                    {isEditing ? (
                      <Input
                        id="lead-value"
                        type="number"
                        value={formData.value}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, value: e.target.value }))
                        }
                      />
                    ) : (
                      <p className="text-sm py-2 font-semibold">
                        {formData.value
                          ? `R$ ${Number(formData.value).toLocaleString("pt-BR")}`
                          : "-"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead-source">Origem</Label>
                  {isEditing ? (
                    <Select
                      value={formData.source}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, source: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : formData.source ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm",
                        sourceColors[formData.source] || sourceColors["Outro"]
                      )}
                    >
                      {formData.source}
                    </Badge>
                  ) : (
                    <p className="text-sm py-2">-</p>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1"
                      >
                        {tag}
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {isEditing && (
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Nova tag"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                          className="h-7 w-24 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleAddTag}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {!isEditing && formData.tags.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma tag</p>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Criado em:{" "}
                      {format(new Date(lead.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {lead.last_contact_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        Último contato:{" "}
                        {format(new Date(lead.last_contact_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={handleDelete}
                    disabled={deleteLead.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Lead
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Form/Custom Fields Tab */}
            <TabsContent value="form" className="mt-0 space-y-4">
              {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Campos recebidos do formulário externo:
                  </p>
                  <div className="grid gap-3">
                    {Object.entries(lead.custom_fields).map(([key, value]) => {
                      // Format key from snake_case or camelCase to readable
                      const formatKey = (k: string) => 
                        k.replace(/_/g, ' ')
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^\w/, c => c.toUpperCase())
                          .trim();
                      
                      return (
                        <div 
                          key={key}
                          className="p-3 bg-muted/50 rounded-lg border"
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {formatKey(key)}
                          </p>
                          <p className="text-sm">
                            {value !== null && value !== undefined 
                              ? String(value) 
                              : "-"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum campo de formulário</p>
                  <p className="text-xs mt-1">
                    Campos extras enviados via webhook aparecerão aqui
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 space-y-4">
              {/* Add Note */}
              <div className="space-y-2">
                <Label>Adicionar Nota</Label>
                <Textarea
                  placeholder="Digite uma nota sobre este lead..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || updateLead.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Nota
                </Button>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {noteEntries.length > 0 ? (
                  noteEntries.reverse().map((note, index) => {
                    const [timestamp, ...content] = note.split("\n");
                    return (
                      <div
                        key={index}
                        className="p-3 bg-muted/50 rounded-lg border"
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          {timestamp.replace(/[\[\]]/g, "")}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {content.join("\n")}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota adicionada</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              <div className="space-y-4">
                {/* Timeline */}
                <div className="relative pl-6 border-l-2 border-border space-y-6">
                  {lead.last_contact_at && (
                    <div className="relative">
                      <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-primary border-2 border-background" />
                      <div className="text-sm">
                        <p className="font-medium">Último contato</p>
                        <p className="text-muted-foreground">
                          {format(
                            new Date(lead.last_contact_at),
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-muted border-2 border-background" />
                    <div className="text-sm">
                      <p className="font-medium">Última atualização</p>
                      <p className="text-muted-foreground">
                        {format(
                          new Date(lead.updated_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-success border-2 border-background" />
                    <div className="text-sm">
                      <p className="font-medium">Lead criado</p>
                      <p className="text-muted-foreground">
                        {format(
                          new Date(lead.created_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                      {lead.source && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-1 text-xs",
                            sourceColors[lead.source] || sourceColors["Outro"]
                          )}
                        >
                          Origem: {lead.source}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-center">
                    Histórico detalhado de movimentações em breve
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      <WhatsAppChoiceDialog
        open={whatsAppChoice.isOpen}
        onOpenChange={whatsAppChoice.setIsOpen}
        phone={whatsAppChoice.targetPhone}
        contactName={whatsAppChoice.targetName}
      />
    </Dialog>
  );
}
