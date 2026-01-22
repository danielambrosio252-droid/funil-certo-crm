import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { useFlowEditor, FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { flowNodeTypes, availableNodeTypes } from "./FlowNodeTypes";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { cn } from "@/lib/utils";

type FlowEditorNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  draggable: boolean;
  data: {
    label: string;
    config: Record<string, unknown>;
    createdAt: string;
    onConfigure: () => void;
  };
};

type FlowEditorEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  label: string | null;
  animated: boolean;
  style: { stroke: string; strokeWidth: number };
};

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { 
    nodes: dbNodes, 
    edges: dbEdges, 
    loadingNodes,
    loadingEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge: addDbEdge,
    deleteEdge,
    saveFlow,
  } = useFlowEditor(flowId);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Placement helpers
  const nodesRef = useRef<Node[]>([]);
  const lastPlacedRef = useRef<{ x: number; y: number } | null>(null);

  // Quando detectamos um layout inconsistente ao abrir, aplicamos uma correção automática (determinística)
  // só 1x por abertura do editor.
  const didAutoFixRef = useRef(false);
  useEffect(() => {
    didAutoFixRef.current = false;
  }, [flowId]);

  // Convert DB nodes to React Flow format
  const initialNodes = useMemo(() => 
    dbNodes.map((node) => ({
      id: node.id,
      type: node.node_type as NodeType,
      position: { x: node.position_x, y: node.position_y },
      draggable: node.node_type !== "start", // mantém o "Início" fixo (evita bagunça acidental)
      data: { 
        label: getNodeLabel(node.node_type),
        config: node.config,
        createdAt: node.created_at,
        onConfigure: () => {
          setSelectedNode({
            id: node.id,
            type: node.node_type,
            position: { x: node.position_x, y: node.position_y },
            data: { config: node.config },
          });
          setShowConfigDialog(true);
        },
      },
    })) as FlowEditorNode[], [dbNodes]);

  // Convert DB edges to React Flow format
  const initialEdges = useMemo(() => 
    dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      label: edge.label,
      animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    })) as FlowEditorEdge[], [dbEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowEditorNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEditorEdge>(initialEdges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Sync with DB data
  useEffect(() => {
    const mapped = dbNodes.map((node) => ({
      id: node.id,
      type: node.node_type as NodeType,
      position: { x: node.position_x, y: node.position_y },
      draggable: node.node_type !== "start",
      data: { 
        label: getNodeLabel(node.node_type),
        config: node.config,
        createdAt: node.created_at,
        onConfigure: () => {
          setSelectedNode({
            id: node.id,
            type: node.node_type,
            position: { x: node.position_x, y: node.position_y },
            data: { config: node.config },
          });
          setShowConfigDialog(true);
        },
      },
    })) as FlowEditorNode[];

    setNodes(mapped);

    // Keep lastPlacedRef in sync with persisted positions
    if (dbNodes.length > 0) {
      const maxNode = dbNodes.reduce(
        (prev, curr) => (prev.position_y > curr.position_y ? prev : curr),
        dbNodes[0]
      );
      lastPlacedRef.current = { x: Math.round(maxNode.position_x), y: Math.round(maxNode.position_y) };
    } else {
      lastPlacedRef.current = null;
    }
  }, [dbNodes, setNodes]);

  useEffect(() => {
    setEdges(
      (dbEdges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle,
        label: edge.label,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      })) as FlowEditorEdge[])
    );
  }, [dbEdges, setEdges]);

  // Auto-correção: SEMPRE aplica layout sequencial ao abrir o editor (garante organização)
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (didAutoFixRef.current) return;
    if (dbNodes.length === 0) return;

    didAutoFixRef.current = true;

    const mappedNodes: FlowEditorNode[] = dbNodes.map((node) => ({
      id: node.id,
      type: node.node_type as NodeType,
      position: { x: node.position_x, y: node.position_y },
      draggable: node.node_type !== "start",
      data: {
        label: getNodeLabel(node.node_type),
        config: node.config,
        createdAt: node.created_at,
        onConfigure: () => {
          setSelectedNode({
            id: node.id,
            type: node.node_type,
            position: { x: node.position_x, y: node.position_y },
            data: { config: node.config },
          });
          setShowConfigDialog(true);
        },
      },
    }));

    // Aplica layout sequencial limpo
    const newPositions = computeSequentialLayout(mappedNodes);
    
    const organizedNodes = mappedNodes.map((node) => {
      const pos = newPositions.get(node.id);
      return pos ? { ...node, position: pos } : node;
    });

    setNodes(organizedNodes);

    // Atualiza referência para próximo nó
    if (organizedNodes.length > 0) {
      const lastNode = organizedNodes[organizedNodes.length - 1];
      lastPlacedRef.current = { x: lastNode.position.x, y: lastNode.position.y };
    }
  }, [dbNodes, loadingNodes, loadingEdges, setNodes]);

  // Handle new connections
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      
      try {
        await addDbEdge.mutateAsync({
          source_node_id: connection.source,
          target_node_id: connection.target,
          source_handle: connection.sourceHandle || undefined,
        });
      } catch (error) {
        console.error("Error adding edge:", error);
      }
    },
    [addDbEdge]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      for (const edge of edgesToDelete) {
        try {
          await deleteEdge.mutateAsync(edge.id);
        } catch (error) {
          console.error("Error deleting edge:", error);
        }
      }
    },
    [deleteEdge]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    async (nodesToDelete: Node[]) => {
      for (const node of nodesToDelete) {
        if (node.type === "start") continue; // Don't delete start node
        try {
          await deleteNode.mutateAsync(node.id);
        } catch (error) {
          console.error("Error deleting node:", error);
        }
      }
    },
    [deleteNode]
  );

  // Add new node - SEMPRE adiciona abaixo do último nó na sequência
  const handleAddNode = async (type: NodeType) => {
    const currentNodes = nodesRef.current;
    const CENTER_X = 300;
    const NODE_GAP_Y = 140;
    const START_Y = 60;

    // Calcula próxima posição Y baseado no número de nós
    const nextY = START_Y + currentNodes.length * NODE_GAP_Y;

    // Reserva slot imediatamente (previne sobreposição em cliques rápidos)
    lastPlacedRef.current = { x: CENTER_X, y: nextY };

    try {
      await addNode.mutateAsync({
        node_type: type,
        position_x: CENTER_X,
        position_y: nextY,
      });
    } catch (error) {
      console.error("Error adding node:", error);
    }
  };

  // Save flow (positions)
  const handleSave = async () => {
    const nodesToSave: FlowNode[] = nodes.map((node) => ({
      id: node.id,
      flow_id: flowId,
      company_id: "",
      node_type: node.type as NodeType,
      position_x: Math.round(node.position.x),
      position_y: Math.round(node.position.y),
      config: (node.data?.config || {}) as Record<string, unknown>,
      created_at: "",
    }));

    const edgesToSave: FlowEdge[] = edges.map((edge) => ({
      id: edge.id,
      flow_id: flowId,
      company_id: "",
      source_node_id: edge.source,
      target_node_id: edge.target,
      source_handle: edge.sourceHandle || null,
      label: typeof edge.label === "string" ? edge.label : null,
      created_at: "",
    }));

    await saveFlow.mutateAsync({ nodes: nodesToSave, edges: edgesToSave });
  };

  // Update node config
  const handleUpdateNodeConfig = async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({ id: nodeId, config });
      setShowConfigDialog(false);
      setSelectedNode(null);
    } catch (error) {
      console.error("Error updating node:", error);
    }
  };

  // Auto-organize layout - sequência vertical simples
  const handleAutoOrganize = () => {
    const currentNodes = nodesRef.current;

    if (currentNodes.length === 0) return;

    const newPositions = computeSequentialLayout(currentNodes);
    if (newPositions.size === 0) {
      toast.error("Nenhum nó encontrado");
      return;
    }

    // Aplica novas posições
    setNodes((prev) =>
      prev.map((node) => {
        const pos = newPositions.get(node.id);
        return pos ? { ...node, position: pos } : node;
      })
    );

    // Atualiza lastPlacedRef
    const lastPos = Array.from(newPositions.values()).pop();
    if (lastPos) {
      lastPlacedRef.current = lastPos;
    }

    toast.success("Layout reorganizado! Clique em 'Salvar Fluxo' para persistir.");
  };

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">{flowName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleAutoOrganize}>
            <LayoutGrid className="w-4 h-4 mr-2" />
            Auto-organizar
          </Button>
          <Button onClick={handleSave} disabled={saveFlow.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      {/* Flow Editor */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={flowNodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-muted/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls className="!bg-background !border-border !shadow-lg" />
          <MiniMap 
            className="!bg-background !border-border !shadow-lg"
            nodeColor={(node) => {
              switch (node.type) {
                case "start": return "#10b981";
                case "message": return "#3b82f6";
                case "template": return "#8b5cf6";
                case "media": return "#f97316";
                case "delay": return "#f59e0b";
                case "wait_response": return "#ec4899";
                case "condition": return "#6366f1";
                case "end": return "#6b7280";
                default: return "#6b7280";
              }
            }}
          />

          {/* Toolbar */}
          <Panel position="top-left" className="!m-4">
            <div className="bg-background border rounded-xl shadow-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-3">Adicionar Bloco</p>
              <div className="grid grid-cols-2 gap-2">
                {availableNodeTypes.map((nodeType) => {
                  const Icon = nodeType.icon;
                  return (
                    <button
                      key={nodeType.type}
                      onClick={() => handleAddNode(nodeType.type as NodeType)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                        "hover:bg-muted text-sm"
                      )}
                    >
                      <div className={cn("p-1.5 rounded", nodeType.color)}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-medium">{nodeType.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Config Dialog */}
      <NodeConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        node={selectedNode}
        onSave={handleUpdateNodeConfig}
      />
    </div>
  );
}

/**
 * Sistema de layout sequencial simples e determinístico:
 * - Ordena todos os nós pela data de criação (mais antigo primeiro)
 * - "Início" sempre fica primeiro
 * - Posiciona em uma única coluna vertical
 */
function computeSequentialLayout(
  currentNodes: (FlowEditorNode | Node)[]
): Map<string, { x: number; y: number }> {
  const newPositions = new Map<string, { x: number; y: number }>();
  
  if (currentNodes.length === 0) return newPositions;

  // Constantes de layout
  const CENTER_X = 300;
  const START_Y = 60;
  const GAP_Y = 140;

  // Ordena: "start" sempre primeiro, depois por data de criação
  const sortedNodes = [...currentNodes].sort((a, b) => {
    // Start node sempre primeiro
    if ((a as any).type === "start" && (b as any).type !== "start") return -1;
    if ((b as any).type === "start" && (a as any).type !== "start") return 1;

    // Ordenar por data de criação
    const aCreated = (a.data as any)?.createdAt as string | undefined;
    const bCreated = (b.data as any)?.createdAt as string | undefined;
    
    if (aCreated && bCreated) {
      return aCreated.localeCompare(bCreated);
    }
    
    // Fallback para ID
    return a.id.localeCompare(b.id);
  });

  // Posiciona cada nó em sequência vertical
  sortedNodes.forEach((node, index) => {
    newPositions.set(node.id, {
      x: CENTER_X,
      y: START_Y + index * GAP_Y,
    });
  });

  return newPositions;
}

function getNodeLabel(type: string): string {
  const labels: Record<string, string> = {
    start: "Início",
    message: "Mensagem",
    template: "Template Meta",
    media: "Mídia",
    delay: "Aguardar",
    wait_response: "Aguardar Resposta",
    condition: "Condição",
    end: "Fim",
  };
  return labels[type] || type;
}
