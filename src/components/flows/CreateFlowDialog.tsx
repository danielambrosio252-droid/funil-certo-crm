import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWhatsAppFlows, TriggerType, FlowTriggerConfig, FlowScheduleConfig } from "@/hooks/useWhatsAppFlows";
import { useFunnels, useFunnelStages } from "@/hooks/useFunnels";
import { UserPlus, MessageSquare, Calendar, GitBranch } from "lucide-react";

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (flowId: string) => void;
}

const triggerTypes = [
  { value: "new_lead", label: "Novo Lead", icon: UserPlus, description: "Quando um novo lead entra no funil" },
  { value: "keyword", label: "Palavra-chave", icon: MessageSquare, description: "Quando cliente envia palavra específica" },
  { value: "schedule", label: "Agendamento", icon: Calendar, description: "Em horários programados" },
  { value: "stage_change", label: "Mudança de Etapa", icon: GitBranch, description: "Quando lead muda de etapa" },
];

const weekDays = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function CreateFlowDialog({ open, onOpenChange, onSuccess }: CreateFlowDialogProps) {
  const { createFlow } = useWhatsAppFlows();
  const { funnels } = useFunnels();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("new_lead");
  const [triggerConfig, setTriggerConfig] = useState<FlowTriggerConfig>({});
  const [scheduleConfig, setScheduleConfig] = useState<FlowScheduleConfig>({
    days: [1, 2, 3, 4, 5],
    start_time: "09:00",
    end_time: "18:00",
  });

  const selectedFunnel = funnels.find((f) => f.id === triggerConfig.funnel_id);
  const { stages } = useFunnelStages(selectedFunnel?.id || null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTriggerType("new_lead");
    setTriggerConfig({});
    setScheduleConfig({
      days: [1, 2, 3, 4, 5],
      start_time: "09:00",
      end_time: "18:00",
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      const result = await createFlow.mutateAsync({
        name,
        description: description || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        schedule_config: scheduleConfig,
      });

      resetForm();
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(result.id);
      }
    } catch (error) {
      console.error("Error creating flow:", error);
    }
  };

  const updateTriggerConfig = (key: string, value: unknown) => {
    setTriggerConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: number) => {
    setScheduleConfig((prev) => {
      const days = prev.days || [];
      if (days.includes(day)) {
        return { ...prev, days: days.filter((d) => d !== day) };
      } else {
        return { ...prev, days: [...days, day].sort() };
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Criar Novo Fluxo</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 py-4">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome do Fluxo *</Label>
                <Input
                  placeholder="Ex: Boas-vindas Novos Leads"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o objetivo deste fluxo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Trigger Type */}
            <div className="space-y-3">
              <Label>Gatilho (Quando o fluxo inicia)</Label>
              <div className="grid grid-cols-2 gap-2">
                {triggerTypes.map((trigger) => {
                  const Icon = trigger.icon;
                  const isSelected = triggerType === trigger.value;
                  return (
                    <button
                      key={trigger.value}
                      type="button"
                      onClick={() => {
                        setTriggerType(trigger.value as TriggerType);
                        setTriggerConfig({});
                      }}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{trigger.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{trigger.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger Config */}
            {triggerType === "new_lead" && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm">Funil (opcional)</Label>
                  <Select
                    value={triggerConfig.funnel_id || "all"}
                    onValueChange={(value) => updateTriggerConfig("funnel_id", value === "all" ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os funis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os funis</SelectItem>
                      {funnels.map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {triggerType === "keyword" && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm">Palavras-chave</Label>
                  <Input
                    placeholder="oi, olá, quero saber mais"
                    value={(triggerConfig.keywords || []).join(", ")}
                    onChange={(e) => updateTriggerConfig("keywords", e.target.value.split(",").map((k) => k.trim()))}
                  />
                  <p className="text-xs text-muted-foreground">Separe por vírgula</p>
                </div>
              </div>
            )}

            {triggerType === "stage_change" && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm">Funil</Label>
                  <Select
                    value={triggerConfig.funnel_id || ""}
                    onValueChange={(value) => {
                      updateTriggerConfig("funnel_id", value);
                      updateTriggerConfig("stage_id", undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {funnels.map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {triggerConfig.funnel_id && (
                  <div className="space-y-2">
                    <Label className="text-sm">Etapa de Destino</Label>
                    <Select
                      value={triggerConfig.stage_id || ""}
                      onValueChange={(value) => updateTriggerConfig("stage_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Quando entrar nesta etapa" />
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
              </div>
            )}

            {/* Schedule Config (always shown) */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Horários Permitidos</Label>
              <div className="flex flex-wrap gap-1.5">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      (scheduleConfig.days || []).includes(day.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={scheduleConfig.start_time || "09:00"}
                    onChange={(e) => setScheduleConfig((prev) => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={scheduleConfig.end_time || "18:00"}
                    onChange={(e) => setScheduleConfig((prev) => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O fluxo só será executado nesses horários
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createFlow.isPending}>
            Criar Fluxo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
