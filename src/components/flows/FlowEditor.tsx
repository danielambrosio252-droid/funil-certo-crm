import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Zap, Clock, GitBranch, Shuffle, Image, Trash2, GripVertical } from "lucide-react";
import { TriggerSelector } from "./TriggerSelector";
import { useFlowEditor, TriggerType, FlowNode, NodeType } from "@/hooks/useWhatsAppFlows";
import { useState, useCallback } from "react";
import { toast } from "sonner";

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

const nodeTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  messenger: { icon: MessageSquare, label: "Messenger", color: "bg-blue-500" },
  message: { icon: MessageSquare, label: "Mensagem", color: "bg-blue-500" },
  ai_step: { icon: Zap, label: "Etapa de IA", color: "bg-purple-500" },
  actions: { icon: Zap, label: "Ações", color: "bg-emerald-500" },
  condition: { icon: GitBranch, label: "Condição", color: "bg-orange-500" },
  randomizer: { icon: Shuffle, label: "Randomizador", color: "bg-pink-500" },
  smart_delay: { icon: Clock, label: "Atraso Inteligente", color: "bg-slate-500" },
  delay: { icon: Clock, label: "Aguardar", color: "bg-slate-500" },
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

  // Handle adding next step from trigger
  const handleAddNextStep = useCallback(async (type: string, position?: { x: number; y: number }) => {
    try {
      // Map menu type to node type
      let nodeType: NodeType = "message";
      let config: Record<string, unknown> = {};

      switch (type) {
        case "messenger":
        case "message":
          nodeType = "message";
          config = { message: "" };
          break;
        case "ai_step":
          nodeType = "message";
          config = { message: "", ai_enabled: true };
          break;
        case "actions":
          nodeType = "message";
          config = { message: "", is_action: true };
          break;
        case "condition":
          nodeType = "condition";
          config = { conditions: [] };
          break;
        case "randomizer":
          nodeType = "condition";
          config = { is_randomizer: true, variants: [] };
          break;
        case "smart_delay":
        case "delay":
          nodeType = "delay";
          config = { delay_seconds: 5, smart: type === "smart_delay" };
          break;
        case "media":
          nodeType = "media";
          config = { media_url: "", caption: "" };
          break;
      }

      // Calculate position - below the last node or at provided position
      const lastNode = actionNodes[actionNodes.length - 1];
      const positionY = position?.y || (lastNode ? lastNode.position_y + 160 : startNode ? startNode.position_y + 160 : 240);
      const positionX = position?.x || 400;

      // Create the node
      const newNode = await addNode.mutateAsync({
        node_type: nodeType,
        position_x: Math.round(positionX),
        position_y: Math.round(positionY),
        config,
      });

      // Connect to previous node (start node or last action node)
      const sourceNodeId = lastNode?.id || startNode?.id;
      if (sourceNodeId) {
        await addEdge.mutateAsync({
          source_node_id: sourceNodeId,
          target_node_id: newNode.id,
        });
      }

      toast.success(`Bloco "${nodeTypeConfig[type]?.label || type}" adicionado!`);
    } catch (error: any) {
      toast.error("Erro ao adicionar bloco: " + error.message);
    }
  }, [actionNodes, startNode, addNode, addEdge]);

  // Handle updating node config
  const handleUpdateNodeConfig = useCallback(async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({ id: nodeId, config });
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  }, [updateNode]);

  // Handle deleting a node
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      // Delete connected edges first
      const connectedEdges = edges.filter(e => e.source_node_id === nodeId || e.target_node_id === nodeId);
      for (const edge of connectedEdges) {
        await deleteEdge.mutateAsync(edge.id);
      }
      await deleteNode.mutateAsync(nodeId);
      toast.success("Bloco removido!");
    } catch (error: any) {
      toast.error("Erro ao remover: " + error.message);
    }
  }, [edges, deleteEdge, deleteNode]);

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm">
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
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Trigger Card */}
          <TriggerSelector
            flowId={flowId}
            startNode={startNode}
            onTriggerSelect={setSelectedTrigger}
            onAddNextStep={handleAddNextStep}
          />

          {/* Action Nodes */}
          {actionNodes.map((node, index) => {
            const config = node.config as Record<string, unknown>;
            const typeKey = config.ai_enabled ? "ai_step" : 
                           config.is_action ? "actions" : 
                           config.is_randomizer ? "randomizer" :
                           config.smart ? "smart_delay" : node.node_type;
            const nodeConfig = nodeTypeConfig[typeKey] || nodeTypeConfig.message;
            const Icon = nodeConfig.icon;

            return (
              <div key={node.id} className="relative">
                {/* Connection line from previous */}
                {index === 0 && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                    <svg width="2" height="32">
                      <line x1="1" y1="0" x2="1" y2="32" stroke="#94a3b8" strokeWidth="2" />
                    </svg>
                  </div>
                )}

                <Card className="bg-white border shadow-md rounded-xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Order number */}
                      <div className="flex items-center gap-2 text-muted-foreground pt-1">
                        <GripVertical className="w-4 h-4 cursor-grab" />
                        <span className="text-sm font-medium w-5">{index + 1}</span>
                      </div>

                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${nodeConfig.color} shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{nodeConfig.label}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteNode(node.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Node-specific content */}
                        {(node.node_type === "message") && (
                          <Textarea
                            placeholder="Digite sua mensagem..."
                            className="min-h-[80px] resize-none text-sm"
                            value={(config.message as string) || ""}
                            onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, message: e.target.value })}
                          />
                        )}

                        {node.node_type === "delay" && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="w-20 text-sm"
                              value={(config.delay_seconds as number) || 5}
                              onChange={(e) => handleUpdateNodeConfig(node.id, { ...config, delay_seconds: parseInt(e.target.value) || 5 })}
                            />
                            <span className="text-sm text-muted-foreground">segundos</span>
                          </div>
                        )}

                        {node.node_type === "media" && (
                          <div className="space-y-2">
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

                        {node.node_type === "condition" && (
                          <p className="text-sm text-muted-foreground">
                            {config.is_randomizer ? "Distribui aleatoriamente" : "Configura condições"}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Connection point to next */}
                <div className="flex justify-center py-2">
                  <svg width="2" height="24">
                    <line x1="1" y1="0" x2="1" y2="24" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
