import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  MessageSquare, 
  Image, 
  Clock, 
  Send,
  Trash2,
  GripVertical,
  MoreVertical,
} from "lucide-react";
import { FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { UseMutationResult } from "@tanstack/react-query";

interface ActionBuilderProps {
  flowId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeId: string | undefined;
  addNode: UseMutationResult<FlowNode, Error, any>;
  addEdge: UseMutationResult<FlowEdge, Error, any>;
  updateNode: UseMutationResult<FlowNode, Error, any>;
  deleteNode: UseMutationResult<void, Error, string>;
  deleteEdge: UseMutationResult<void, Error, string>;
}

const actionOptions = [
  {
    type: "message" as NodeType,
    icon: MessageSquare,
    label: "Mensagem",
    description: "Enviar uma mensagem de texto",
    color: "bg-emerald-500",
  },
  {
    type: "media" as NodeType,
    icon: Image,
    label: "Imagem/Mídia",
    description: "Enviar uma imagem ou arquivo",
    color: "bg-violet-500",
  },
  {
    type: "delay" as NodeType,
    icon: Clock,
    label: "Aguardar",
    description: "Esperar antes da próxima ação",
    color: "bg-orange-500",
  },
  {
    type: "template" as NodeType,
    icon: Send,
    label: "Template",
    description: "Enviar template aprovado do Meta",
    color: "bg-blue-500",
  },
];

export function ActionBuilder({
  flowId,
  nodes,
  edges,
  startNodeId,
  addNode,
  addEdge,
  updateNode,
  deleteNode,
  deleteEdge,
}: ActionBuilderProps) {
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);

  // Sort nodes by their position (vertical order)
  const sortedNodes = [...nodes].sort((a, b) => a.position_y - b.position_y);

  const handleAddAction = async (type: NodeType) => {
    try {
      // Calculate position for new node
      const lastNode = sortedNodes[sortedNodes.length - 1];
      const positionY = lastNode ? lastNode.position_y + 160 : 240;
      
      // Default config based on type
      let config: Record<string, unknown> = {};
      if (type === "message") {
        config = { message: "" };
      } else if (type === "delay") {
        config = { delay_seconds: 5 };
      } else if (type === "media") {
        config = { media_url: "", caption: "" };
      }

      const newNode = await addNode.mutateAsync({
        node_type: type,
        position_x: 400,
        position_y: positionY,
        config,
      });

      // Connect to previous node
      const sourceNodeId = lastNode?.id || startNodeId;
      if (sourceNodeId) {
        await addEdge.mutateAsync({
          source_node_id: sourceNodeId,
          target_node_id: newNode.id,
        });
      }

      setShowActionDialog(false);
      toast.success("Ação adicionada!");
    } catch (error: any) {
      toast.error("Erro ao adicionar ação: " + error.message);
    }
  };

  const handleUpdateNodeConfig = async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({
        id: nodeId,
        config,
      });
      setEditingNode(null);
      toast.success("Ação atualizada!");
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      // Delete edges connected to this node
      const connectedEdges = edges.filter(
        e => e.source_node_id === nodeId || e.target_node_id === nodeId
      );
      for (const edge of connectedEdges) {
        await deleteEdge.mutateAsync(edge.id);
      }
      
      await deleteNode.mutateAsync(nodeId);
      toast.success("Ação removida!");
    } catch (error: any) {
      toast.error("Erro ao remover: " + error.message);
    }
  };

  const getActionOption = (type: NodeType) => {
    return actionOptions.find(a => a.type === type);
  };

  return (
    <div className="space-y-3">
      {/* Existing Actions */}
      {sortedNodes.map((node, index) => {
        const action = getActionOption(node.node_type);
        if (!action) return null;

        const config = node.config as Record<string, unknown>;

        return (
          <Card key={node.id} className="bg-white border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                
                <div className={`p-2 rounded-lg ${action.color}`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{action.label}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingNode(node)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteNode(node.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Inline content preview/editor */}
                  {node.node_type === "message" && (
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      className="min-h-[80px] resize-none"
                      value={(config.message as string) || ""}
                      onChange={(e) => {
                        handleUpdateNodeConfig(node.id, { ...config, message: e.target.value });
                      }}
                    />
                  )}

                  {node.node_type === "delay" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20"
                        value={(config.delay_seconds as number) || 5}
                        onChange={(e) => {
                          handleUpdateNodeConfig(node.id, { 
                            ...config, 
                            delay_seconds: parseInt(e.target.value) || 5 
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">segundos</span>
                    </div>
                  )}

                  {node.node_type === "media" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="URL da imagem..."
                        value={(config.media_url as string) || ""}
                        onChange={(e) => {
                          handleUpdateNodeConfig(node.id, { ...config, media_url: e.target.value });
                        }}
                      />
                      <Input
                        placeholder="Legenda (opcional)"
                        value={(config.caption as string) || ""}
                        onChange={(e) => {
                          handleUpdateNodeConfig(node.id, { ...config, caption: e.target.value });
                        }}
                      />
                    </div>
                  )}

                  {node.node_type === "template" && (
                    <p className="text-sm text-muted-foreground">
                      Template: {(config.template_name as string) || "Nenhum selecionado"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add Action Button */}
      <Card className="border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-slate-100 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">Adicionar Ação</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              {actionOptions.map((option) => (
                <DropdownMenuItem
                  key={option.type}
                  onClick={() => handleAddAction(option.type)}
                  className="flex items-center gap-3 p-3"
                >
                  <div className={`p-2 rounded-lg ${option.color}`}>
                    <option.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  );
}
