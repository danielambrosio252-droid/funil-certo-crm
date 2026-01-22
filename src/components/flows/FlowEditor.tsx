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
  type NodeChange,
  type EdgeChange,
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

// ============================================================================
// STABLE FLOW EDITOR - ManyChat-style stability
// ============================================================================
// RULES:
// 1. NO auto-layout on load/render - layout ONLY on explicit user action
// 2. Node positions are deterministic and persisted
// 3. Edges are IMMUTABLE after creation - no re-rendering
// 4. Camera/zoom changes do NOT trigger layout recalculation
// 5. Stability > aesthetics
// ============================================================================

type FlowEditorNode = Node<{
  label: string;
  config: Record<string, unknown>;
  createdAt: string;
  nodeIndex: number;
  onConfigure: () => void;
  onUpdateConfig: (config: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}>;

type FlowEditorEdge = Edge<Record<string, unknown>>;

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

// Layout constants
const LAYOUT = {
  CENTER_X: 400,
  START_Y: 80,
  GAP_Y: 180,
};

// Edge styling - STATIC, never changes
const EDGE_STYLE = {
  stroke: "#64748b",
  strokeWidth: 2,
};

const EDGE_MARKER = {
  type: MarkerType.ArrowClosed as const,
  color: "#64748b",
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

  // Refs for stability - prevent re-renders from causing instability
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const initializedRef = useRef(false);
  const hasEnsuredMinimumRef = useRef(false);

  // Track if we've done initial sync
  const didInitialSyncRef = useRef(false);

  // Node index map for display
  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...dbNodes].sort((a, b) => {
      if (a.node_type === "start") return -1;
      if (b.node_type === "start") return 1;
      return a.created_at.localeCompare(b.created_at);
    });
    let idx = 0;
    sorted.forEach((n) => {
      if (n.node_type !== "start") {
        idx++;
        map.set(n.id, idx);
      }
    });
    return map;
  }, [dbNodes]);

  // Inline config update
  const handleInlineUpdate = useCallback(
    async (nodeId: string, config: Record<string, unknown>) => {
      try {
        await updateNode.mutateAsync({ id: nodeId, config });
      } catch (e) {
        console.error("Inline update failed:", e);
      }
    },
    [updateNode]
  );

  // Duplicate node
  const handleDuplicateNode = useCallback(
    async (node: (typeof dbNodes)[0]) => {
      const maxY = Math.max(...dbNodes.map((n) => n.position_y), LAYOUT.START_Y);
      try {
        await addNode.mutateAsync({
          node_type: node.node_type,
          position_x: Math.round(LAYOUT.CENTER_X),
          position_y: Math.round(maxY + LAYOUT.GAP_Y),
          config: { ...node.config },
        });
        toast.success("Bloco duplicado!");
      } catch (e) {
        console.error("Duplicate failed:", e);
        toast.error("Erro ao duplicar");
      }
    },
    [addNode, dbNodes]
  );

  // Delete node
  const handleDeleteNodeById = useCallback(
    async (nodeId: string, nodeType: string) => {
      if (nodeType === "start") {
        toast.error("Não é possível excluir o bloco inicial");
        return;
      }
      try {
        await deleteNode.mutateAsync(nodeId);
        toast.success("Bloco excluído!");
      } catch (e) {
        console.error("Delete failed:", e);
        toast.error("Erro ao excluir");
      }
    },
    [deleteNode]
  );

  // Convert DB node to React Flow node - STABLE, no random changes
  const toFlowNode = useCallback(
    (dbNode: (typeof dbNodes)[0]): FlowEditorNode => ({
      id: dbNode.id,
      type: dbNode.node_type as string,
      position: { x: dbNode.position_x, y: dbNode.position_y },
      draggable: dbNode.node_type !== "start",
      data: {
        label: getNodeLabel(dbNode.node_type),
        config: dbNode.config,
        createdAt: dbNode.created_at,
        nodeIndex: nodeIndexMap.get(dbNode.id) || 0,
        onConfigure: () => {
          setSelectedNode({
            id: dbNode.id,
            type: dbNode.node_type,
            position: { x: dbNode.position_x, y: dbNode.position_y },
            data: { config: dbNode.config },
          });
          setShowConfigDialog(true);
        },
        onUpdateConfig: (config: Record<string, unknown>) =>
          handleInlineUpdate(dbNode.id, config),
        onDuplicate: () => handleDuplicateNode(dbNode),
        onDelete:
          dbNode.node_type !== "start"
            ? () => handleDeleteNodeById(dbNode.id, dbNode.node_type)
            : undefined,
      },
    }),
    [nodeIndexMap, handleInlineUpdate, handleDuplicateNode, handleDeleteNodeById]
  );

  // Convert DB edge to React Flow edge - IMMUTABLE styling
  const toFlowEdge = useCallback((dbEdge: (typeof dbEdges)[0]): FlowEditorEdge => ({
    id: dbEdge.id,
    source: dbEdge.source_node_id,
    target: dbEdge.target_node_id,
    sourceHandle: dbEdge.source_handle || undefined,
    label: dbEdge.label || undefined,
    type: "smoothstep",
    animated: false,
    markerEnd: EDGE_MARKER,
    style: EDGE_STYLE,
  }), []);

  // Initial nodes/edges from DB
  const initialNodes = useMemo(() => dbNodes.map(toFlowNode), [dbNodes, toFlowNode]);
  const initialEdges = useMemo(() => dbEdges.map(toFlowEdge), [dbEdges, toFlowEdge]);

  // React Flow state - CONTROLLED
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowEditorNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEditorEdge>(initialEdges);

  // STABLE: Only sync from DB when data actually changes, NOT on every render
  useEffect(() => {
    if (loadingNodes || authLoading) return;
    if (didInitialSyncRef.current && dbNodes.length === nodes.length) {
      // Only update if node count changed (add/delete) - don't override positions
      return;
    }
    
    didInitialSyncRef.current = true;
    setNodes(dbNodes.map(toFlowNode));
  }, [dbNodes, loadingNodes, authLoading, toFlowNode, setNodes, nodes.length]);

  // Sync edges only when DB edges change
  useEffect(() => {
    if (loadingEdges || authLoading) return;
    setEdges(dbEdges.map(toFlowEdge));
  }, [dbEdges, loadingEdges, authLoading, toFlowEdge, setEdges]);

  // Ensure minimum flow (Start + Message) - ONCE only
  useEffect(() => {
    if (loadingNodes || hasEnsuredMinimumRef.current) return;
    if (dbNodes.length > 0) {
      hasEnsuredMinimumRef.current = true;
      return;
    }

    hasEnsuredMinimumRef.current = true;

    const createMinimum = async () => {
      try {
        await addNode.mutateAsync({
          node_type: "start",
          position_x: LAYOUT.CENTER_X,
          position_y: LAYOUT.START_Y,
          config: {},
        });
        await addNode.mutateAsync({
          node_type: "message",
          position_x: LAYOUT.CENTER_X,
          position_y: LAYOUT.START_Y + LAYOUT.GAP_Y,
          config: {},
        });
      } catch (e) {
        console.error("Failed to create minimum flow:", e);
        hasEnsuredMinimumRef.current = false;
      }
    };

    void createMinimum();
  }, [loadingNodes, dbNodes.length, addNode]);

  // Reset refs when flowId changes
  useEffect(() => {
    initializedRef.current = false;
    hasEnsuredMinimumRef.current = false;
    didInitialSyncRef.current = false;
  }, [flowId]);

  // STABLE node change handler - only handle position changes, no auto-layout
  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowEditorNode>[]) => {
      // Filter out any automatic dimension changes that could cause instability
      const safeChanges = changes.filter((change) => {
        // Allow position changes (drag)
        if (change.type === "position") return true;
        // Allow selection changes
        if (change.type === "select") return true;
        // Allow removal
        if (change.type === "remove") return true;
        // Block dimension changes that could cause jitter
        if (change.type === "dimensions") return false;
        return true;
      });
      onNodesChange(safeChanges);
    },
    [onNodesChange]
  );

  // STABLE edge change handler
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<FlowEditorEdge>[]) => {
      // Only allow selection and removal, block any automatic updates
      const safeChanges = changes.filter(
        (change) => change.type === "select" || change.type === "remove"
      );
      onEdgesChange(safeChanges);
    },
    [onEdgesChange]
  );

  // Handle new connection - create in DB, edge will sync automatically
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        await addDbEdge.mutateAsync({
          source_node_id: connection.source,
          target_node_id: connection.target,
          source_handle: connection.sourceHandle || undefined,
        });
      } catch (e) {
        console.error("Connect failed:", e);
      }
    },
    [addDbEdge]
  );

  // Delete edges
  const handleEdgesDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      for (const edge of edgesToDelete) {
        try {
          await deleteEdge.mutateAsync(edge.id);
        } catch (e) {
          console.error("Delete edge failed:", e);
        }
      }
    },
    [deleteEdge]
  );

  // Delete nodes
  const handleNodesDelete = useCallback(
    async (nodesToDelete: Node[]) => {
      for (const node of nodesToDelete) {
        if (node.type === "start") continue;
        try {
          await deleteNode.mutateAsync(node.id);
        } catch (e) {
          console.error("Delete node failed:", e);
        }
      }
    },
    [deleteNode]
  );

  // Add new node
  const handleAddNode = async (type: NodeType) => {
    const maxY = Math.max(...nodes.map((n) => n.position.y), LAYOUT.START_Y - LAYOUT.GAP_Y);
    try {
      await addNode.mutateAsync({
        node_type: type,
        // IMPORTANT: DB expects integer coordinates.
        position_x: Math.round(LAYOUT.CENTER_X),
        position_y: Math.round(maxY + LAYOUT.GAP_Y),
      });
    } catch (e) {
      console.error("Add node failed:", e);
    }
  };

  // Save flow - persist current positions
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

    try {
      await saveFlow.mutateAsync({ nodes: nodesToSave, edges: edgesToSave });
      toast.success("Fluxo salvo!");
    } catch (e) {
      console.error("Save failed:", e);
      toast.error("Erro ao salvar");
    }
  };

  // Update node config from modal
  const handleUpdateNodeConfig = async (nodeId: string, config: Record<string, unknown>) => {
    try {
      await updateNode.mutateAsync({ id: nodeId, config });
      setShowConfigDialog(false);
      setSelectedNode(null);
    } catch (e) {
      console.error("Config update failed:", e);
    }
  };

  // MANUAL auto-organize - ONLY on explicit user action
  const handleAutoOrganize = () => {
    if (nodes.length === 0) return;

    const sorted = [...nodes].sort((a, b) => {
      if (a.type === "start") return -1;
      if (b.type === "start") return 1;
      return (a.data.createdAt || "").localeCompare(b.data.createdAt || "");
    });

    setNodes(
      sorted.map((node, index) => ({
        ...node,
        position: {
          x: LAYOUT.CENTER_X,
          y: LAYOUT.START_Y + index * LAYOUT.GAP_Y,
        },
      }))
    );

    toast.success("Layout organizado! Clique em Salvar para persistir.");
  };

  // Center view - MANUAL only
  const handleCenterView = () => {
    rfInstanceRef.current?.fitView({
      padding: 0.3,
      minZoom: 0.5,
      maxZoom: 1.5,
    });
  };

  // Initialize ReactFlow
  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    initializedRef.current = true;
    // Fit view once on init
    setTimeout(() => {
      instance.fitView({ padding: 0.3, minZoom: 0.5, maxZoom: 1.5 });
    }, 100);
  }, []);

  // Loading states
  if (authLoading || !profile?.company_id) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
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
    <div className="h-full flex flex-col" style={{ backgroundColor: "#1e293b" }}>
      {/* Header */}
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
            onClick={handleCenterView}
            className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600"
          >
            Centralizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoOrganize}
            className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600"
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
            Salvar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" style={{ backgroundColor: "#1e293b" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          nodeTypes={flowNodeTypes}
          onInit={handleInit}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={["Backspace", "Delete"]}
          style={{ backgroundColor: "#1e293b" }}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            markerEnd: EDGE_MARKER,
            style: EDGE_STYLE,
          }}
          // STABILITY: Disable automatic behaviors that cause jitter
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          // Don't auto-fit on changes
          fitView={false}
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
                case "start":
                  return "#10b981";
                case "message":
                  return "#10b981";
                case "template":
                  return "#8b5cf6";
                case "media":
                  return "#f97316";
                case "delay":
                  return "#f59e0b";
                case "wait_response":
                  return "#ec4899";
                case "condition":
                  return "#6366f1";
                case "end":
                  return "#64748b";
                default:
                  return "#64748b";
              }
            }}
          />

          {/* Add Node Panel */}
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
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Selecione uma ação
                  </p>
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

          {/* Tip */}
          <Panel position="bottom-center" className="!mb-4">
            <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/30 rounded-xl px-4 py-2 text-xs text-slate-400">
              💡 Arraste blocos para posicionar • Conecte saídas às entradas • Clique em
              Salvar para persistir
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Config Dialog */}
      <NodeConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        node={selectedNode}
        onSave={handleUpdateNodeConfig}
      />
    </div>
  );
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
