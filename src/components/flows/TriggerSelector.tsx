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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  UserPlus, 
  MessageSquare, 
  Calendar, 
  GitBranch,
  X,
  Zap,
  Edit,
  Shuffle,
  Clock,
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
  onAddNextStep?: (type: string) => void;
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

export function TriggerSelector({ flowId, startNode, onTriggerSelect, onAddNextStep }: TriggerSelectorProps) {
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedTriggerType, setSelectedTriggerType] = useState<TriggerType | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [showNextStepMenu, setShowNextStepMenu] = useState(false);
  
  // Config state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  
  const { funnels } = useFunnels();
  const { stages } = useFunnelStages(selectedFunnelId || null);
  const { updateFlow } = useWhatsAppFlows();

  const handleAddNextStep = (type: string) => {
    setShowNextStepMenu(false);
    onAddNextStep?.(type);
    toast.success(`Bloco "${type}" será adicionado!`);
  };

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
      {/* Trigger Card - Compact with connection point */}
      <div className="relative inline-block">
        <Card className="w-80 bg-white border border-slate-200 shadow-lg rounded-xl overflow-visible">
          <CardContent className="p-4">
            {hasTrigger && currentTrigger ? (
              // Trigger configured - show it
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-slate-700">Quando...</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${currentTrigger.color}`}>
                      <currentTrigger.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{currentTrigger.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentTriggerType === "keyword" && (
                          <>Palavras: {((currentConfig?.keywords || []) as string[]).slice(0, 2).join(", ")}{((currentConfig?.keywords || []) as string[]).length > 2 ? "..." : ""}</>
                        )}
                        {(currentTriggerType === "new_lead" || currentTriggerType === "stage_change") && (
                          <>Funil selecionado</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowTriggerDialog(true)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveTrigger}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // No trigger - show add button
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-slate-700">Quando...</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  O gatilho é responsável por acionar a automação.<br />
                  Clique para adicionar um gatilho.
                </p>
                <div 
                  className="border-2 border-dashed border-cyan-400 rounded-lg p-3 text-center cursor-pointer hover:bg-cyan-50 transition-colors"
                  onClick={() => setShowTriggerDialog(true)}
                >
                  <span className="text-cyan-600 font-medium text-sm">+ Novo Gatilho</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection point - "Então" with dot and menu */}
        <div className="absolute -bottom-8 right-4 flex items-center gap-2">
          <span className="text-sm text-slate-500 font-medium">Então</span>
          
          {/* Connection dot with dropdown menu */}
          <DropdownMenu open={showNextStepMenu} onOpenChange={setShowNextStepMenu}>
            <DropdownMenuTrigger asChild>
              <div className="w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow cursor-pointer hover:bg-primary hover:scale-125 transition-all flex items-center justify-center" />
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              side="right" 
              className="w-52 bg-white border shadow-lg rounded-lg z-50"
              sideOffset={20}
            >
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("messenger")}
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>+ Messenger</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("ai_step")}
              >
                <Zap className="w-4 h-4 text-purple-500" />
                <span>+ Etapa de IA</span>
                <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0.5">AI</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("actions")}
              >
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>+ Ações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("condition")}
              >
                <GitBranch className="w-4 h-4 text-orange-500" />
                <span>+ Condição</span>
                <Badge className="ml-auto text-xs px-1.5 py-0.5 bg-amber-500">PRO</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("randomizer")}
              >
                <Shuffle className="w-4 h-4 text-pink-500" />
                <span>+ Randomizador</span>
                <Badge className="ml-auto text-xs px-1.5 py-0.5 bg-amber-500">PRO</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => handleAddNextStep("smart_delay")}
              >
                <Clock className="w-4 h-4 text-slate-500" />
                <span>+ Atraso Inteligente</span>
                <Badge className="ml-auto text-xs px-1.5 py-0.5 bg-amber-500">PRO</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex items-center gap-2 p-3 text-muted-foreground cursor-pointer"
                onClick={() => setShowNextStepMenu(false)}
              >
                Cancelar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Connection line curving to the right */}
        <svg 
          className="absolute -bottom-6 right-0 pointer-events-none"
          width="80" 
          height="60" 
          style={{ transform: 'translate(60px, 8px)' }}
        >
          <path 
            d="M 0 0 Q 40 0 60 30" 
            fill="none"
            stroke="#94a3b8" 
            strokeWidth="2" 
          />
        </svg>
      </div>

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
