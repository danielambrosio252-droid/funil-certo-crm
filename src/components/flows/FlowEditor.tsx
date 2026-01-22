import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  MarkerType,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, LayoutGrid, Plus, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useFlowEditor, FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { flowNodeTypes, availableNodeTypes } from "./FlowNodeTypes";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FlowEditorNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  draggable: boolean;
  data: {
    label: string;
    config: Record<string, unknown>;
    createdAt: string;
    nodeIndex: number;
    onConfigure: () => void;
    onUpdateConfig: (config: Record<string, unknown>) => void;
  };
};

type FlowEditorEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  label: string | null;
  animated: boolean;
  type: string;
  markerEnd: { type: MarkerType; color: string };
  style: { stroke: string; strokeWidth: number };
};

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

// Constants for VERTICAL layout (Clean, professional, top-to-bottom)
const LAYOUT = {
  CENTER_X: 400,
  START_Y: 80,
  GAP_Y: 180,
  NODE_WIDTH: 340,
};

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { profile, loading: authLoading } = useAuth();
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
  const [rfInitTick, setRfInitTick] = useState(0);

  // Guard against render loops: keep mutation fns in refs so callbacks/effects stay stable.
  const updateNodeMutateRef = useRef(updateNode.mutateAsync);
  useEffect(() => {
    updateNodeMutateRef.current = updateNode.mutateAsync;
  }, [updateNode.mutateAsync]);

  const didAutoFixRef = useRef(false);
  const didEnsureStartRef = useRef(false);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const lastFitViewTsRef = useRef(0);

  // IMPORTANT: react-query can temporarily return `undefined` data when queries are disabled
  // (e.g. auth/profile briefly toggles). If we blindly map that to [], the canvas looks like
  // "sumiu" after ~1-2s. We keep the last non-empty snapshot to avoid clearing the editor.
  const lastStableDbNodesRef = useRef<typeof dbNodes>([]);
  const lastStableDbEdgesRef = useRef<typeof dbEdges>([]);

  useEffect(() => {
    if (!loadingNodes && dbNodes.length > 0) {
      lastStableDbNodesRef.current = dbNodes;
    }
  }, [dbNodes, loadingNodes]);

  useEffect(() => {
    if (!loadingEdges && dbEdges.length > 0) {
      lastStableDbEdgesRef.current = dbEdges;
    }
  }, [dbEdges, loadingEdges]);

  const requestFitView = useCallback(() => {
    const inst = rfInstanceRef.current;
    if (!inst) return;
    const now = Date.now();
    // throttle to avoid jitter / loops
    if (now - lastFitViewTsRef.current < 300) return;
    lastFitViewTsRef.current = now;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          inst.fitView({
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 1.5,
          });
        } catch (e) {
          console.error("fitView failed:", e);
        }
      });
    });
  }, []);
  useEffect(() => {
    didAutoFixRef.current = false;
    didEnsureStartRef.current = false;
    lastStableDbNodesRef.current = [];
    lastStableDbEdgesRef.current = [];
    setRfInitTick(0);
  }, [flowId]);

  const ensureStartNode = useCallback(async () => {
    if (didEnsureStartRef.current) return;
    if (loadingNodes) return;
    if (dbNodes.length > 0) return;

    didEnsureStartRef.current = true;
    try {
      await addNode.mutateAsync({
        node_type: "start",
        position_x: LAYOUT.CENTER_X,
        position_y: LAYOUT.START_Y,
        config: {},
      });
    } catch (error) {
      didEnsureStartRef.current = false;
      console.error("Error creating start node:", error);
      toast.error("Não consegui criar o bloco inicial. Tente novamente.");
    }
  }, [addNode, dbNodes.length, loadingNodes]);

  // Se por qualquer motivo um fluxo vier sem nós (ex: dados antigos), cria o START automaticamente.
  useEffect(() => {
    if (loadingNodes) return;
    if (dbNodes.length > 0) return;
    void ensureStartNode();
  }, [dbNodes.length, ensureStartNode, loadingNodes]);

  // Build node index map
  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    const sortedNodes = [...dbNodes].sort((a, b) => {
      if (a.node_type === "start") return -1;
      if (b.node_type === "start") return 1;
      return a.created_at.localeCompare(b.created_at);
    });
    
    let index = 0;
    sortedNodes.forEach((node) => {
      if (node.node_type !== "start") {
        index++;
        map.set(node.id, index);
      }
    });
    return map;
  }, [dbNodes]);

  // Inline update handler for chat nodes
  const handleInlineUpdate = useCallback(async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNodeMutateRef.current({ id: nodeId, config });
    } catch (error) {
      console.error("Error updating node inline:", error);
    }
  }, []);

  // Handle node duplication
  const handleDuplicateNode = useCallback(async (node: typeof dbNodes[0]) => {
    try {
      // Find max Y position to place duplicate below
      let maxY = node.position_y;
      dbNodes.forEach((n) => {
        if (n.position_y > maxY) maxY = n.position_y;
      });

      await addNode.mutateAsync({
        node_type: node.node_type,
        position_x: node.position_x,
        position_y: maxY + LAYOUT.GAP_Y,
        config: { ...node.config },
      });
      toast.success("Bloco duplicado!");
    } catch (error) {
      console.error("Error duplicating node:", error);
      toast.error("Erro ao duplicar bloco");
    }
  }, [addNode, dbNodes]);

  // Handle node deletion
  const handleDeleteNodeById = useCallback(async (nodeId: string, nodeType: string) => {
    if (nodeType === "start") {
      toast.error("Não é possível excluir o bloco inicial");
      return;
    }
    try {
      await deleteNode.mutateAsync(nodeId);
      toast.success("Bloco excluído!");
    } catch (error) {
      console.error("Error deleting node:", error);
      toast.error("Erro ao excluir bloco");
    }
  }, [deleteNode]);

  // Convert DB nodes to React Flow format
  const createNodeData = useCallback((node: typeof dbNodes[0]) => ({
    id: node.id,
    type: node.node_type as NodeType,
    position: { x: node.position_x, y: node.position_y },
    draggable: node.node_type !== "start",
    data: { 
      label: getNodeLabel(node.node_type),
      config: node.config,
      createdAt: node.created_at,
      nodeIndex: nodeIndexMap.get(node.id) || 0,
      onConfigure: () => {
        setSelectedNode({
          id: node.id,
          type: node.node_type,
          position: { x: node.position_x, y: node.position_y },
          data: { config: node.config },
        });
        setShowConfigDialog(true);
      },
      onUpdateConfig: (config: Record<string, unknown>) => {
        handleInlineUpdate(node.id, config);
      },
      onDuplicate: () => handleDuplicateNode(node),
      onDelete: node.node_type !== "start" ? () => handleDeleteNodeById(node.id, node.node_type) : undefined,
    },
  }), [nodeIndexMap, handleInlineUpdate, handleDuplicateNode, handleDeleteNodeById]);

  const initialNodes = useMemo(() => 
    dbNodes.map(createNodeData) as FlowEditorNode[], 
    [dbNodes, createNodeData]
  );

  // Convert DB edges to React Flow format
  const initialEdges = useMemo(() => 
    dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      label: edge.label,
      animated: false,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      style: { stroke: "#64748b", strokeWidth: 2 },
    })) as FlowEditorEdge[], [dbEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowEditorNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEditorEdge>(initialEdges);

  // Sync with DB data
  useEffect(() => {
    // If DB temporarily reports empty while still loading/auth gating, do NOT wipe the canvas.
    if ((loadingNodes || authLoading) && dbNodes.length === 0) return;

    const source = dbNodes.length > 0 ? dbNodes : lastStableDbNodesRef.current;
    const mapped = source.map(createNodeData) as FlowEditorNode[];
    setNodes(mapped);
  }, [dbNodes, setNodes, createNodeData, loadingNodes, authLoading]);

  // Keep viewport stable: fit on initial load AND after automatic re-layout.
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (nodes.length === 0) return;
    // rfInitTick ensures ReactFlow instance exists
    if (rfInitTick === 0) return;
    requestFitView();
  }, [loadingNodes, loadingEdges, nodes.length, rfInitTick, requestFitView]);

  useEffect(() => {
    if ((loadingEdges || authLoading) && dbEdges.length === 0) return;

    const source = dbEdges.length > 0 ? dbEdges : lastStableDbEdgesRef.current;
    setEdges(
      (source.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle,
        label: edge.label,
        animated: false,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      })) as FlowEditorEdge[])
    );
  }, [dbEdges, setEdges, loadingEdges, authLoading]);

  // Auto-fix layout on load
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (didAutoFixRef.current) return;
    if (dbNodes.length === 0) return;

    didAutoFixRef.current = true;

    const positions = dbNodes.map(n => ({ x: n.position_x, y: n.position_y }));
    const hasOverlap = positions.some((p1, i) => 
      positions.some((p2, j) => i !== j && Math.abs(p1.y - p2.y) < 120)
    );
    
    const notCentered = positions.some(p => Math.abs(p.x - LAYOUT.CENTER_X) > 50);
    const needsReorganization = hasOverlap || notCentered;

    if (!needsReorganization) return;

    const newPositions = computeVerticalLayout(dbNodes);
    
    const organizedNodes = dbNodes.map(node => {
      const pos = newPositions.get(node.id);
      return createNodeData({
        ...node,
        position_x: pos?.x ?? node.position_x,
        position_y: pos?.y ?? node.position_y,
      });
    }) as FlowEditorNode[];

    setNodes(organizedNodes);
    // Important: viewport must be refit AFTER nodes are repositioned, otherwise it looks like it "disappeared".
    requestFitView();

    const nodesToSave: FlowNode[] = organizedNodes.map((node) => ({
      id: node.id,
      flow_id: flowId,
      company_id: "",
      node_type: node.type as NodeType,
      position_x: Math.round(node.position.x),
      position_y: Math.round(node.position.y),
      config: (node.data?.config || {}) as Record<string, unknown>,
      created_at: "",
    }));

    const edgesToSave: FlowEdge[] = dbEdges.map((edge) => ({
      id: edge.id,
      flow_id: flowId,
      company_id: "",
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
      source_handle: edge.source_handle || null,
      label: edge.label || null,
      created_at: "",
    }));

    saveFlow.mutateAsync({ nodes: nodesToSave, edges: edgesToSave }).then(() => {
      toast.success("Layout organizado!");
    });
  }, [dbNodes, dbEdges, loadingNodes, loadingEdges, setNodes, flowId, saveFlow, createNodeData, requestFitView]);

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

  const onNodesDelete = useCallback(
    async (nodesToDelete: Node[]) => {
      for (const node of nodesToDelete) {
        if (node.type === "start") continue;
        try {
          await deleteNode.mutateAsync(node.id);
        } catch (error) {
          console.error("Error deleting node:", error);
        }
      }
    },
    [deleteNode]
  );

  // Add new node - VERTICAL layout
  const handleAddNode = async (type: NodeType) => {
    const currentNodes = nodes;
    
    let maxY = LAYOUT.START_Y - LAYOUT.GAP_Y;
    currentNodes.forEach((node) => {
      if (node.position.y > maxY) {
        maxY = node.position.y;
      }
    });

    const nextY = maxY + LAYOUT.GAP_Y;

    try {
      await addNode.mutateAsync({
        node_type: type,
        position_x: LAYOUT.CENTER_X,
        position_y: nextY,
      });
    } catch (error) {
      console.error("Error adding node:", error);
    }
  };

  // Save flow
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

  // Update node config (from modal)
  const handleUpdateNodeConfig = async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({ id: nodeId, config });
      setShowConfigDialog(false);
      setSelectedNode(null);
    } catch (error) {
      console.error("Error updating node:", error);
    }
  };

  // Auto-organize
  const handleAutoOrganize = () => {
    if (nodes.length === 0) return;

    const newPositions = computeVerticalLayout(
      nodes.map(n => ({
        id: n.id,
        node_type: n.type,
        position_x: n.position.x,
        position_y: n.position.y,
        created_at: n.data.createdAt,
        config: n.data.config,
        company_id: "",
        flow_id: flowId,
      }))
    );

    setNodes((prev) =>
      prev.map((node) => {
        const pos = newPositions.get(node.id);
        return pos ? { ...node, position: pos } : node;
      })
    );

    requestFitView();

    toast.success("Layout reorganizado!");
  };

  // Guard: don't render the editor until auth/profile is ready.
  if (authLoading || !profile?.company_id) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <div className="text-sm text-muted-foreground">Carregando seu workspace…</div>
        </div>
      </div>
    );
  }

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#1e293b' }}>
      {/* Professional Header - Stripe-style */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-600 bg-slate-800">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="text-white hover:text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-slate-500" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">{flowName}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={requestFitView}
            className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white"
          >
            Centralizar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoOrganize}
            className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Organizar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveFlow.isPending}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-lg"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      {/* Flow Editor Canvas - Professional dark graphite */}
      <div className="flex-1 relative" style={{ backgroundColor: '#1e293b' }}>
        {/* Estado vazio "à prova de tela escura" */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">Comece o seu fluxo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Este fluxo ainda não tem nenhum bloco. Crie o bloco inicial para liberar o canvas e os
                próximos passos.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={ensureStartNode} disabled={addNode.isPending}>
                  Criar bloco inicial
                </Button>
                <Button variant="outline" onClick={onBack}>
                  Voltar
                </Button>
              </div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={flowNodeTypes}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
            setRfInitTick((t) => t + 1);
            // Ensure we frame nodes immediately on mount.
            requestAnimationFrame(() => requestFitView());
          }}
          fitView
          fitViewOptions={{
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={["Backspace", "Delete"]}
          style={{ backgroundColor: '#1e293b' }}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1.5} 
            color="#475569"
          />
          <Controls className="!bg-slate-700 !border-slate-500 !shadow-xl !rounded-lg [&_button]:!bg-slate-600 [&_button]:!border-slate-400 [&_button]:hover:!bg-slate-500 [&_button_svg]:!fill-white [&_button]:!rounded-md" />
          <MiniMap 
            className="!bg-slate-800/80 !backdrop-blur-sm !border-slate-700/50 !shadow-xl !rounded-xl"
            maskColor="rgba(0,0,0,0.85)"
            nodeColor={(node) => {
              switch (node.type) {
                case "start": return "#10b981";
                case "message": return "#10b981";
                case "template": return "#8b5cf6";
                case "media": return "#f97316";
                case "delay": return "#f59e0b";
                case "wait_response": return "#ec4899";
                case "condition": return "#6366f1";
                case "end": return "#64748b";
                default: return "#64748b";
              }
            }}
          />

          {/* Floating Add Panel */}
          <Panel position="top-center" className="!mt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="default" 
                  className="bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/50 shadow-2xl px-6 backdrop-blur-sm rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Etapa
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="center" 
                className="w-72 bg-slate-800/95 backdrop-blur-sm border-slate-700/50 shadow-2xl p-2 rounded-xl"
              >
                <div className="px-3 py-2 mb-2 border-b border-slate-700/50">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Selecione uma ação</p>
                </div>
                <div className="grid gap-1">
                  {availableNodeTypes.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <DropdownMenuItem
                        key={nodeType.type}
                        onClick={() => handleAddNode(nodeType.type as NodeType)}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50 rounded-xl"
                      >
                        <div className={cn("p-2 rounded-xl", nodeType.bgColor)}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">{nodeType.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </Panel>

          {/* Tip panel */}
          <Panel position="bottom-center" className="!mb-4">
            <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/30 rounded-xl px-4 py-2 text-xs text-slate-400">
              💡 Clique em uma mensagem para editar diretamente • Conecte botões aos próximos passos
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Config Dialog - for non-message nodes */}
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
 * Vertical layout algorithm
 */
function computeVerticalLayout(
  nodes: Array<{ id: string; node_type: string; created_at: string; position_x: number; position_y: number }>
): Map<string, { x: number; y: number }> {
  const newPositions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return newPositions;

  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.node_type === "start") return -1;
    if (b.node_type === "start") return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  sortedNodes.forEach((node, index) => {
    newPositions.set(node.id, {
      x: LAYOUT.CENTER_X,
      y: LAYOUT.START_Y + index * LAYOUT.GAP_Y,
    });
  });

  return newPositions;
}

function getNodeLabel(type: string): string {
  const labels: Record<string, string> = {
    start: "Iniciar robô",
    message: "Enviar mensagem",
    template: "Template Meta",
    media: "Enviar mídia",
    delay: "Pausar",
    wait_response: "Aguardar resposta",
    condition: "Condição",
    end: "Fim",
  };
  return labels[type] || type;
}
