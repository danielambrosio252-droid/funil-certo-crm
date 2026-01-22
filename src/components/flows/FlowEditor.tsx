import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  MessageSquare, 
  Zap, 
  Clock, 
  GitBranch, 
  Shuffle, 
  Image, 
  Trash2, 
  Plus,
  Smile,
  Braces,
  X,
} from "lucide-react";
import { TriggerSelector } from "./TriggerSelector";
import { useFlowEditor, TriggerType, FlowNode, NodeType } from "@/hooks/useWhatsAppFlows";
import { toast } from "sonner";

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

const nodeTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  messenger: { icon: MessageSquare, label: "Enviar Mensagem", color: "bg-blue-500" },
  message: { icon: MessageSquare, label: "Enviar Mensagem", color: "bg-blue-500" },
  ai_step: { icon: Zap, label: "Etapa de IA", color: "bg-purple-500" },
  actions: { icon: Zap, label: "Ações", color: "bg-emerald-500" },
  condition: { icon: GitBranch, label: "Condição", color: "bg-orange-500" },
  randomizer: { icon: Shuffle, label: "Randomizador", color: "bg-pink-500" },
  smart_delay: { icon: Clock, label: "Atraso Inteligente", color: "bg-slate-500" },
  delay: { icon: Clock, label: "Aguardar", color: "bg-orange-500" },
  media: { icon: Image, label: "Mídia", color: "bg-violet-500" },
};

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { nodes, edges, loadingNodes, addNode, addEdge, updateNode, deleteNode, deleteEdge } = useFlowEditor(flowId);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);

  // Get start node
  const startNode = nodes.find(n => n.node_type === "start");
  
  // Get action nodes (non-start nodes) sorted by position
  const actionNodes = nodes
    .filter(n => n.node_type !== "start")
    .sort((a, b) => a.position_y - b.position_y);

  // Handle adding next step
  const handleAddNextStep = useCallback(async (type: string, position?: { x: number; y: number }) => {
    try {
      let nodeType: NodeType = "message";
      let config: Record<string, unknown> = {};

      switch (type) {
        case "messenger":
        case "message":
          nodeType = "message";
          config = { message: "", buttons: [] };
          break;
        case "ai_step":
          nodeType = "message";
          config = { message: "", buttons: [], ai_enabled: true };
          break;
        case "delay":
        case "smart_delay":
          nodeType = "delay";
          config = { delay_seconds: 5, smart: type === "smart_delay" };
          break;
        case "media":
          nodeType = "media";
          config = { media_url: "", caption: "" };
          break;
        case "condition":
          nodeType = "condition";
          config = { conditions: [] };
          break;
        case "randomizer":
          nodeType = "condition";
          config = { is_randomizer: true };
          break;
        default:
          nodeType = "message";
          config = { message: "", buttons: [] };
      }

      const lastNode = actionNodes[actionNodes.length - 1];
      const positionY = lastNode ? lastNode.position_y + 200 : startNode ? startNode.position_y + 200 : 280;

      const newNode = await addNode.mutateAsync({
        node_type: nodeType,
        position_x: 400,
        position_y: Math.round(positionY),
        config,
      });

      const sourceNodeId = lastNode?.id || startNode?.id;
      if (sourceNodeId) {
        await addEdge.mutateAsync({
          source_node_id: sourceNodeId,
          target_node_id: newNode.id,
        });
      }

      toast.success("Bloco adicionado!");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  }, [actionNodes, startNode, addNode, addEdge]);

  const handleUpdateNodeConfig = useCallback(async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({ id: nodeId, config });
    } catch (error: any) {
      console.error(error);
    }
  }, [updateNode]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      const connectedEdges = edges.filter(e => e.source_node_id === nodeId || e.target_node_id === nodeId);
      for (const edge of connectedEdges) {
        await deleteEdge.mutateAsync(edge.id);
      }
      await deleteNode.mutateAsync(nodeId);
      toast.success("Bloco removido!");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  }, [edges, deleteEdge, deleteNode]);

  const handleAddButton = useCallback((nodeId: string, config: Record<string, unknown>) => {
    const buttons = (config.buttons as string[]) || [];
    const newButtons = [...buttons, `Botão ${buttons.length + 1}`];
    handleUpdateNodeConfig(nodeId, { ...config, buttons: newButtons });
  }, [handleUpdateNodeConfig]);

  const handleRemoveButton = useCallback((nodeId: string, config: Record<string, unknown>, index: number) => {
    const buttons = (config.buttons as string[]) || [];
    const newButtons = buttons.filter((_, i) => i !== index);
    handleUpdateNodeConfig(nodeId, { ...config, buttons: newButtons });
  }, [handleUpdateNodeConfig]);

  const handleUpdateButton = useCallback((nodeId: string, config: Record<string, unknown>, index: number, value: string) => {
    const buttons = (config.buttons as string[]) || [];
    const newButtons = [...buttons];
    newButtons[index] = value;
    handleUpdateNodeConfig(nodeId, { ...config, buttons: newButtons });
  }, [handleUpdateNodeConfig]);

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{flowName}</h1>
            <p className="text-sm text-muted-foreground">Editor de Automação</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>Voltar</Button>
          <Button>Publicar</Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-8">
        <div className="min-h-full flex flex-col items-center">
          
          {/* Trigger Card */}
          <TriggerSelector
            flowId={flowId}
            startNode={startNode}
            onTriggerSelect={setSelectedTrigger}
            onAddNextStep={handleAddNextStep}
          />

          {/* Connection line from trigger */}
          {actionNodes.length > 0 && (
            <svg width="2" height="40" className="my-2">
              <line x1="1" y1="0" x2="1" y2="40" stroke="#94a3b8" strokeWidth="2" />
            </svg>
          )}

          {/* Action Nodes */}
          {actionNodes.map((node, index) => {
            const config = node.config as Record<string, unknown>;
            const buttons = (config.buttons as string[]) || [];
            const typeKey = config.ai_enabled ? "ai_step" : config.is_randomizer ? "randomizer" : node.node_type;
            const nodeConfig = nodeTypeConfig[typeKey] || nodeTypeConfig.message;
            const Icon = nodeConfig.icon;

            return (
              <div key={node.id} className="flex flex-col items-center">
                {/* ManyChat-style Message Block */}
                <Card className="w-96 bg-white border shadow-lg rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${nodeConfig.color}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-sm">{nodeConfig.label}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteNode(node.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Message Type */}
                    {node.node_type === "message" && (
                      <>
                        {/* Text Area */}
                        <div className="border-2 border-dashed border-cyan-400 rounded-lg p-3 bg-cyan-50/30">
                          <Textarea
                            placeholder="Adicionar texto..."
                            className="min-h-[80px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-sm"
                            value={(config.message as string) || ""}
                            onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, message: e.target.value })}
                          />
                          
                          {/* Toolbar */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-cyan-200">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Smile className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Braces className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {((config.message as string) || "").length}/2000
                            </span>
                          </div>
                        </div>

                        {/* Buttons */}
                        {buttons.length > 0 && (
                          <div className="space-y-2">
                            {buttons.map((btn, btnIndex) => (
                              <div key={btnIndex} className="flex items-center gap-2">
                                <Input
                                  value={btn}
                                  onChange={(e) => handleUpdateButton(node.id, config, btnIndex, e.target.value)}
                                  className="text-sm"
                                  placeholder="Texto do botão..."
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleRemoveButton(node.id, config, btnIndex)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Button */}
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-muted-foreground hover:text-primary"
                          onClick={() => handleAddButton(node.id, config)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Botão Adicionar
                        </Button>
                      </>
                    )}

                    {/* Delay Type */}
                    {node.node_type === "delay" && (
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <span className="text-sm">Aguardar</span>
                        <Input
                          type="number"
                          className="w-20 text-sm"
                          value={(config.delay_seconds as number) || 5}
                          onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, delay_seconds: parseInt(e.target.value) || 5 })}
                        />
                        <span className="text-sm text-muted-foreground">segundos</span>
                      </div>
                    )}

                    {/* Media Type */}
                    {node.node_type === "media" && (
                      <div className="space-y-3">
                        <Input
                          placeholder="URL da imagem..."
                          className="text-sm"
                          value={(config.media_url as string) || ""}
                          onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, media_url: e.target.value })}
                        />
                        <Input
                          placeholder="Legenda (opcional)"
                          className="text-sm"
                          value={(config.caption as string) || ""}
                          onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, caption: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Condition Type */}
                    {node.node_type === "condition" && (
                      <div className="p-3 bg-orange-50 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                          {config.is_randomizer ? "Distribuir aleatoriamente" : "Configurar condições"}
                        </p>
                      </div>
                    )}

                    {/* Next Step Connection */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <span className="text-sm text-slate-500">Próximo Passo</span>
                      <NextStepDot onAddNextStep={handleAddNextStep} />
                    </div>
                  </CardContent>
                </Card>

                {/* Connection line to next node */}
                {index < actionNodes.length - 1 && (
                  <svg width="2" height="40" className="my-2">
                    <line x1="1" y1="0" x2="1" y2="40" stroke="#94a3b8" strokeWidth="2" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Reusable Next Step Dot Component
function NextStepDot({ onAddNextStep }: { onAddNextStep: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow cursor-pointer hover:bg-primary hover:scale-125 transition-all" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-white border shadow-lg rounded-lg z-50">
        <DropdownMenuItem onClick={() => { setOpen(false); onAddNextStep("messenger"); }}>
          <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
          + Messenger
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setOpen(false); onAddNextStep("ai_step"); }}>
          <Zap className="w-4 h-4 mr-2 text-purple-500" />
          + Etapa de IA
          <Badge variant="secondary" className="ml-auto text-xs">AI</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setOpen(false); onAddNextStep("delay"); }}>
          <Clock className="w-4 h-4 mr-2 text-orange-500" />
          + Aguardar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setOpen(false); onAddNextStep("condition"); }}>
          <GitBranch className="w-4 h-4 mr-2 text-orange-500" />
          + Condição
          <Badge className="ml-auto text-xs bg-amber-500">PRO</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setOpen(false); onAddNextStep("randomizer"); }}>
          <Shuffle className="w-4 h-4 mr-2 text-pink-500" />
          + Randomizador
          <Badge className="ml-auto text-xs bg-amber-500">PRO</Badge>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setOpen(false)} className="text-muted-foreground">
          Cancelar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
