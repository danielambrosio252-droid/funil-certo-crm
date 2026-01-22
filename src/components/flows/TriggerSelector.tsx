import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  UserPlus, 
  MessageSquare, 
  Calendar, 
  GitBranch,
  X,
  Zap,
} from "lucide-react";
import { FlowNode, TriggerType, useWhatsAppFlows } from "@/hooks/useWhatsAppFlows";
import { useFunnels, useFunnelStages } from "@/hooks/useFunnels";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface TriggerSelectorProps {
  flowId: string;
  startNode: FlowNode | undefined;
  onTriggerSelect: (trigger: TriggerType | null) => void;
}

const triggerOptions = [
  {
    type: "new_lead" as TriggerType,
    icon: UserPlus,
    label: "Novo Lead",
    description: "Dispara quando um novo lead entra no funil",
    color: "bg-emerald-500",
  },
  {
    type: "keyword" as TriggerType,
    icon: MessageSquare,
    label: "Palavra-chave",
    description: "Dispara quando o contato envia uma palavra específica",
    color: "bg-blue-500",
  },
  {
    type: "schedule" as TriggerType,
    icon: Calendar,
    label: "Agendamento",
    description: "Dispara em horários programados",
    color: "bg-purple-500",
  },
  {
    type: "stage_change" as TriggerType,
    icon: GitBranch,
    label: "Mudança de Etapa",
    description: "Dispara quando lead muda de etapa no funil",
    color: "bg-orange-500",
  },
];

export function TriggerSelector({ flowId, startNode, onTriggerSelect }: TriggerSelectorProps) {
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedTriggerType, setSelectedTriggerType] = useState<TriggerType | null>(null);
  const [configuring, setConfiguring] = useState(false);
  
  // Config state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  
  const { funnels } = useFunnels();
  const { stages } = useFunnelStages(selectedFunnelId || null);
  const { updateFlow } = useWhatsAppFlows();

  // Check current trigger config
  const currentConfig = startNode?.config as Record<string, unknown> | undefined;
  const hasTrigger = currentConfig && Object.keys(currentConfig).length > 0;
  const currentTriggerType = currentConfig?.trigger_type as TriggerType | undefined;

  const getCurrentTriggerOption = () => {
    if (!currentTriggerType) return null;
    return triggerOptions.find(t => t.type === currentTriggerType);
  };

  const handleSelectTriggerType = (type: TriggerType) => {
    setSelectedTriggerType(type);
    setConfiguring(true);
    // Reset config state
    setKeywords([]);
    setKeywordInput("");
    setSelectedFunnelId("");
    setSelectedStageId("");
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim().toLowerCase())) {
      setKeywords([...keywords, keywordInput.trim().toLowerCase()]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleSaveTrigger = async () => {
    if (!startNode || !selectedTriggerType) return;

    let config: Record<string, unknown> = { trigger_type: selectedTriggerType };

    switch (selectedTriggerType) {
      case "keyword":
        if (keywords.length === 0) {
          toast.error("Adicione pelo menos uma palavra-chave");
          return;
        }
        config.keywords = keywords;
        break;
      case "new_lead":
      case "stage_change":
        if (!selectedFunnelId) {
          toast.error("Selecione um funil");
          return;
        }
        config.funnel_id = selectedFunnelId;
        if (selectedTriggerType === "stage_change" && selectedStageId) {
          config.stage_id = selectedStageId;
        }
        break;
    }

    try {
      // Update start node config
      const { error: nodeError } = await supabase
        .from("whatsapp_flow_nodes")
        .update({ config: config as Json })
        .eq("id", startNode.id);

      if (nodeError) throw nodeError;

      // Update flow trigger_type and trigger_config
      await updateFlow.mutateAsync({
        id: flowId,
        trigger_type: selectedTriggerType,
        trigger_config: config as any,
      });

      onTriggerSelect(selectedTriggerType);
      setShowTriggerDialog(false);
      setConfiguring(false);
      toast.success("Gatilho configurado!");
    } catch (error: any) {
      toast.error("Erro ao salvar gatilho: " + error.message);
    }
  };

  const handleRemoveTrigger = async () => {
    if (!startNode) return;

    try {
      await supabase
        .from("whatsapp_flow_nodes")
        .update({ config: {} as Json })
        .eq("id", startNode.id);

      await updateFlow.mutateAsync({
        id: flowId,
        trigger_type: "new_lead", // Default
        trigger_config: {},
      });

      onTriggerSelect(null);
      toast.success("Gatilho removido!");
    } catch (error: any) {
      toast.error("Erro ao remover gatilho: " + error.message);
    }
  };

  const currentTrigger = getCurrentTriggerOption();

  return (
    <>
      <Card className="border-2 border-dashed border-cyan-400 bg-white hover:border-cyan-500 transition-colors">
        <CardContent className="p-6">
          {hasTrigger && currentTrigger ? (
            // Trigger configured - show it
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${currentTrigger.color}`}>
                  <currentTrigger.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{currentTrigger.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentTriggerType === "keyword" && (
                      <>Palavras: {((currentConfig?.keywords || []) as string[]).join(", ")}</>
                    )}
                    {(currentTriggerType === "new_lead" || currentTriggerType === "stage_change") && (
                      <>Funil selecionado</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTriggerDialog(true)}>
                  Editar
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRemoveTrigger}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            // No trigger - show add button
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <p className="font-medium">Quando...</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                O gatilho é responsável por acionar a automação.<br />
                Clique para adicionar um gatilho.
              </p>
              <Button
                variant="outline"
                className="border-cyan-400 text-cyan-600 hover:bg-cyan-50"
                onClick={() => setShowTriggerDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Gatilho
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trigger Selection Dialog */}
      <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {configuring ? "Configurar Gatilho" : "Selecionar Gatilho"}
            </DialogTitle>
          </DialogHeader>

          {!configuring ? (
            // Step 1: Select trigger type
            <div className="grid gap-3 py-4">
              {triggerOptions.map((option) => (
                <Card
                  key={option.type}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectTriggerType(option.type)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`p-3 rounded-lg ${option.color}`}>
                      <option.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Step 2: Configure trigger
            <div className="py-4 space-y-4">
              {selectedTriggerType === "keyword" && (
                <div className="space-y-3">
                  <Label>Palavras-chave</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite uma palavra-chave..."
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    />
                    <Button onClick={handleAddKeyword}>Adicionar</Button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="gap-1">
                          {keyword}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => handleRemoveKeyword(keyword)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    O fluxo será acionado quando o contato enviar qualquer uma dessas palavras.
                  </p>
                </div>
              )}

              {(selectedTriggerType === "new_lead" || selectedTriggerType === "stage_change") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Funil</Label>
                    <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funil..." />
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

                  {selectedTriggerType === "stage_change" && selectedFunnelId && (
                    <div className="space-y-2">
                      <Label>Etapa (opcional)</Label>
                      <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Qualquer etapa..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Qualquer etapa</SelectItem>
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

              {selectedTriggerType === "schedule" && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    Configuração de agendamento em breve...
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setConfiguring(false)}>
                  Voltar
                </Button>
                <Button onClick={handleSaveTrigger}>
                  Salvar Gatilho
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
