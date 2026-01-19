import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight,
  Clock,
  Tag,
  Bell,
  UserPlus,
  RefreshCw,
  Plus,
  Trash2
} from "lucide-react";
import { 
  useFunnelAutomations, 
  FunnelAutomation, 
  TriggerType, 
  ActionType,
  AutomationCondition 
} from "@/hooks/useFunnelAutomations";
import { FunnelStage } from "@/hooks/useFunnels";

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string | null;
  stages: FunnelStage[];
  automationToEdit: FunnelAutomation | null;
}

const triggerOptions: { value: TriggerType; label: string; icon: React.ReactNode }[] = [
  { value: "lead_created", label: "Lead criado", icon: <UserPlus className="w-4 h-4" /> },
  { value: "lead_updated", label: "Lead atualizado", icon: <RefreshCw className="w-4 h-4" /> },
  { value: "time_in_stage", label: "Tempo na etapa", icon: <Clock className="w-4 h-4" /> },
  { value: "value_changed", label: "Valor alterado", icon: <RefreshCw className="w-4 h-4" /> },
  { value: "tag_added", label: "Tag adicionada", icon: <Tag className="w-4 h-4" /> },
];

const actionOptions: { value: ActionType; label: string; icon: React.ReactNode }[] = [
  { value: "move_to_stage", label: "Mover para etapa", icon: <ArrowRight className="w-4 h-4" /> },
  { value: "add_tag", label: "Adicionar tag", icon: <Tag className="w-4 h-4" /> },
  { value: "remove_tag", label: "Remover tag", icon: <Tag className="w-4 h-4" /> },
  { value: "send_notification", label: "Enviar notificação", icon: <Bell className="w-4 h-4" /> },
];

const conditionOperators = [
  { value: "equals", label: "é igual a" },
  { value: "not_equals", label: "não é igual a" },
  { value: "contains", label: "contém" },
  { value: "greater_than", label: "é maior que" },
  { value: "less_than", label: "é menor que" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
];

const conditionFields = [
  { value: "name", label: "Nome" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
  { value: "value", label: "Valor" },
  { value: "source", label: "Origem" },
  { value: "tags", label: "Tags" },
];

export function CreateAutomationDialog({
  open,
  onOpenChange,
  funnelId,
  stages,
  automationToEdit,
}: CreateAutomationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("lead_created");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actionType, setActionType] = useState<ActionType>("move_to_stage");
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({});
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);

  const { createAutomation, updateAutomation } = useFunnelAutomations(funnelId);
  const isEditing = !!automationToEdit;

  useEffect(() => {
    if (automationToEdit) {
      setName(automationToEdit.name);
      setDescription(automationToEdit.description || "");
      setTriggerType(automationToEdit.trigger_type);
      setTriggerConfig(automationToEdit.trigger_config);
      setActionType(automationToEdit.action_type);
      setActionConfig(automationToEdit.action_config);
      setConditions(automationToEdit.conditions || []);
    } else {
      resetForm();
    }
  }, [automationToEdit, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTriggerType("lead_created");
    setTriggerConfig({});
    setActionType("move_to_stage");
    setActionConfig({});
    setConditions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing) {
      await updateAutomation.mutateAsync({
        id: automationToEdit.id,
        name,
        description: description || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        action_type: actionType,
        action_config: actionConfig,
        conditions,
      });
    } else {
      await createAutomation.mutateAsync({
        name,
        description,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        action_type: actionType,
        action_config: actionConfig,
        conditions,
      });
    }
    
    onOpenChange(false);
    resetForm();
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "name", operator: "equals", value: "" }]);
  };

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const renderTriggerConfig = () => {
    switch (triggerType) {
      case "lead_created":
        return (
          <div className="space-y-2">
            <Label>Etapa específica (opcional)</Label>
            <Select 
              value={(triggerConfig.stage_id as string) || "any"} 
              onValueChange={(v) => setTriggerConfig({ ...triggerConfig, stage_id: v === "any" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer etapa</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "time_in_stage":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select 
                value={(triggerConfig.stage_id as string) || ""} 
                onValueChange={(v) => setTriggerConfig({ ...triggerConfig, stage_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
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
            <div className="space-y-2">
              <Label>Tempo (em horas)</Label>
              <Input
                type="number"
                min={1}
                value={(triggerConfig.hours as number) || ""}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, hours: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 24"
              />
            </div>
          </div>
        );

      case "tag_added":
        return (
          <div className="space-y-2">
            <Label>Tag</Label>
            <Input
              value={(triggerConfig.tag as string) || ""}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, tag: e.target.value })}
              placeholder="Nome da tag"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderActionConfig = () => {
    switch (actionType) {
      case "move_to_stage":
        return (
          <div className="space-y-2">
            <Label>Etapa destino</Label>
            <Select 
              value={(actionConfig.target_stage_id as string) || ""} 
              onValueChange={(v) => setActionConfig({ ...actionConfig, target_stage_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
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
        );

      case "add_tag":
      case "remove_tag":
        return (
          <div className="space-y-2">
            <Label>Tag</Label>
            <Input
              value={(actionConfig.tag as string) || ""}
              onChange={(e) => setActionConfig({ ...actionConfig, tag: e.target.value })}
              placeholder="Nome da tag"
            />
          </div>
        );

      case "send_notification":
        return (
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={(actionConfig.message as string) || ""}
              onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
              placeholder="Mensagem da notificação"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const isValid = () => {
    if (!name.trim()) return false;
    
    // Validate action config
    switch (actionType) {
      case "move_to_stage":
        if (!actionConfig.target_stage_id) return false;
        break;
      case "add_tag":
      case "remove_tag":
        if (!actionConfig.tag) return false;
        break;
      case "send_notification":
        if (!actionConfig.message) return false;
        break;
    }

    // Validate trigger config for specific triggers
    switch (triggerType) {
      case "time_in_stage":
        if (!triggerConfig.stage_id || !triggerConfig.hours) return false;
        break;
      case "tag_added":
        if (!triggerConfig.tag) return false;
        break;
    }

    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Automação" : "Nova Automação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mover leads sem resposta"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que essa automação faz"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Trigger */}
          <div className="space-y-4">
            <h4 className="font-medium">Quando (Gatilho)</h4>
            <div className="space-y-2">
              <Label>Tipo de gatilho</Label>
              <Select value={triggerType} onValueChange={(v) => {
                setTriggerType(v as TriggerType);
                setTriggerConfig({});
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderTriggerConfig()}
          </div>

          <Separator />

          {/* Conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Condições (opcional)</h4>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
            
            {conditions.length > 0 && (
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Select
                      value={condition.field}
                      onValueChange={(v) => updateCondition(index, { field: v })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateCondition(index, { operator: v as AutomationCondition["operator"] })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionOperators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                      <Input
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="Valor"
                        className="flex-1"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Action */}
          <div className="space-y-4">
            <h4 className="font-medium">Então (Ação)</h4>
            <div className="space-y-2">
              <Label>Tipo de ação</Label>
              <Select value={actionType} onValueChange={(v) => {
                setActionType(v as ActionType);
                setActionConfig({});
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderActionConfig()}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid() || createAutomation.isPending || updateAutomation.isPending}>
              {isEditing ? "Salvar" : "Criar Automação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
