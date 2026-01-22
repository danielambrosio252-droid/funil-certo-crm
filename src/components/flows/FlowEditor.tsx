import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { nodes, edges, loadingNodes, addNode, addEdge, updateNode, deleteNode, deleteEdge } = useFlowEditor(flowId);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);

  const startNode = nodes.find(n => n.node_type === "start");
  const actionNodes = nodes
    .filter(n => n.node_type !== "start")
    .sort((a, b) => a.position_y - b.position_y);

  const handleAddNextStep = useCallback(async (type: string) => {
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
          config = { delay_seconds: 5 };
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
          config = { message: "", buttons: [] };
      }

      const lastNode = actionNodes[actionNodes.length - 1];
      const positionY = lastNode ? lastNode.position_y + 200 : 200;

      const newNode = await addNode.mutateAsync({
        node_type: nodeType,
        position_x: 600,
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
    await updateNode.mutateAsync({ id: nodeId, config });
  }, [updateNode]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    const connectedEdges = edges.filter(e => e.source_node_id === nodeId || e.target_node_id === nodeId);
    for (const edge of connectedEdges) {
      await deleteEdge.mutateAsync(edge.id);
    }
    await deleteNode.mutateAsync(nodeId);
    toast.success("Bloco removido!");
  }, [edges, deleteEdge, deleteNode]);

  const handleAddButton = (nodeId: string, config: Record<string, unknown>) => {
    const buttons = (config.buttons as string[]) || [];
    handleUpdateNodeConfig(nodeId, { ...config, buttons: [...buttons, `Botão ${buttons.length + 1}`] });
  };

  const handleRemoveButton = (nodeId: string, config: Record<string, unknown>, index: number) => {
    const buttons = (config.buttons as string[]) || [];
    handleUpdateNodeConfig(nodeId, { ...config, buttons: buttons.filter((_, i) => i !== index) });
  };

  const handleUpdateButton = (nodeId: string, config: Record<string, unknown>, index: number, value: string) => {
    const buttons = [...((config.buttons as string[]) || [])];
    buttons[index] = value;
    handleUpdateNodeConfig(nodeId, { ...config, buttons });
  };

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
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
          <Button className="bg-primary">Publicar</Button>
        </div>
      </div>

      {/* Canvas - Horizontal Layout */}
      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-start gap-0 min-w-max">
          
          {/* Trigger Card */}
          <div className="shrink-0">
            <TriggerSelector
              flowId={flowId}
              startNode={startNode}
              onTriggerSelect={setSelectedTrigger}
              onAddNextStep={handleAddNextStep}
            />
          </div>

          {/* Curved Connection Line + Message Blocks */}
          {actionNodes.length > 0 && (
            <div className="flex items-start">
              {/* Curved SVG line */}
              <svg width="120" height="200" className="shrink-0 -ml-2" style={{ marginTop: '60px' }}>
                <path 
                  d="M 0 0 C 60 0 60 100 120 100" 
                  fill="none" 
                  stroke="#94a3b8" 
                  strokeWidth="2"
                />
                {/* Arrow */}
                <polygon 
                  points="115,95 120,100 115,105" 
                  fill="#94a3b8"
                />
              </svg>

              {/* Message Blocks Stack */}
              <div className="flex flex-col gap-6 -ml-2">
                {actionNodes.map((node, index) => (
                  <MessageBlock 
                    key={node.id}
                    node={node}
                    onDelete={() => handleDeleteNode(node.id)}
                    onUpdateConfig={(config) => handleUpdateNodeConfig(node.id, config)}
                    onAddButton={(config) => handleAddButton(node.id, config)}
                    onRemoveButton={(config, idx) => handleRemoveButton(node.id, config, idx)}
                    onUpdateButton={(config, idx, val) => handleUpdateButton(node.id, config, idx, val)}
                    onAddNextStep={handleAddNextStep}
                    showConnectionToNext={index < actionNodes.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ManyChat-style Message Block
function MessageBlock({
  node,
  onDelete,
  onUpdateConfig,
  onAddButton,
  onRemoveButton,
  onUpdateButton,
  onAddNextStep,
  showConnectionToNext,
}: {
  node: FlowNode;
  onDelete: () => void;
  onUpdateConfig: (config: Record<string, unknown>) => void;
  onAddButton: (config: Record<string, unknown>) => void;
  onRemoveButton: (config: Record<string, unknown>, index: number) => void;
  onUpdateButton: (config: Record<string, unknown>, index: number, value: string) => void;
  onAddNextStep: (type: string) => void;
  showConnectionToNext: boolean;
}) {
  const config = node.config as Record<string, unknown>;
  const buttons = (config.buttons as string[]) || [];
  const [editingMessage, setEditingMessage] = useState(false);

  return (
    <div className="relative">
      <Card className="w-[420px] bg-white border shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="font-semibold">Enviar Mensagem</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Message Content - Chat Bubble Style */}
          {node.node_type === "message" && (
            <>
              {/* Message Bubble */}
              <div 
                className="bg-slate-100 rounded-2xl rounded-tl-sm p-4 cursor-text min-h-[60px]"
                onClick={() => setEditingMessage(true)}
              >
                {editingMessage ? (
                  <textarea
                    autoFocus
                    className="w-full bg-transparent border-none outline-none resize-none text-sm"
                    placeholder="Digite sua mensagem..."
                    value={(config.message as string) || ""}
                    onChange={(e) => onUpdateConfig({ ...config, message: e.target.value })}
                    onBlur={() => setEditingMessage(false)}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">
                    {(config.message as string) || <span className="text-muted-foreground">Clique para adicionar texto...</span>}
                  </p>
                )}
              </div>

              {/* Buttons with connection dots */}
              {buttons.map((btn, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center border rounded-xl overflow-hidden bg-white">
                    <Input
                      value={btn}
                      onChange={(e) => onUpdateButton(config, idx, e.target.value)}
                      className="border-0 text-center font-medium"
                      placeholder="Texto do botão..."
                    />
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onRemoveButton(config, idx)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Connection dot for button */}
                  <NextStepDot onAddNextStep={onAddNextStep} />
                </div>
              ))}

              {/* Add Button */}
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => onAddButton(config)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Botão
              </Button>
            </>
          )}

          {/* Delay Type */}
          {node.node_type === "delay" && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl">
              <Clock className="w-6 h-6 text-orange-500" />
              <span>Aguardar</span>
              <Input
                type="number"
                className="w-20"
                value={(config.delay_seconds as number) || 5}
                onChange={(e) => onUpdateConfig({ ...config, delay_seconds: parseInt(e.target.value) || 5 })}
              />
              <span className="text-muted-foreground">segundos</span>
            </div>
          )}

          {/* Condition Type */}
          {node.node_type === "condition" && (
            <div className="p-4 bg-orange-50 rounded-xl text-center">
              <GitBranch className="w-6 h-6 mx-auto mb-2 text-orange-500" />
              <p className="text-sm">{config.is_randomizer ? "Randomizador" : "Condição"}</p>
            </div>
          )}

          {/* Next Step - Only if no buttons */}
          {buttons.length === 0 && (
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <span className="text-sm text-slate-500">Próximo Passo</span>
              <NextStepDot onAddNextStep={onAddNextStep} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection line to next block */}
      {showConnectionToNext && (
        <svg width="2" height="40" className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <line x1="1" y1="0" x2="1" y2="40" stroke="#94a3b8" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

// Reusable Next Step Dot
function NextStepDot({ onAddNextStep }: { onAddNextStep: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white cursor-pointer hover:border-primary hover:scale-110 transition-all shadow-sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-52 bg-white">
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
