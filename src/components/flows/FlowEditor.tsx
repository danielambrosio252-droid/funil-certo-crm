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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, LayoutGrid, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useFlowEditor, FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { flowNodeTypes, availableNodeTypes } from "./FlowNodeTypes";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { cn } from "@/lib/utils";
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
  CENTER_X: 400,    // Central X position for all nodes
  START_Y: 80,      // Starting Y position
  GAP_Y: 160,       // Uniform vertical spacing between nodes
  NODE_WIDTH: 280,
};

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

  // Track if we already auto-fixed the layout for this session
  const didAutoFixRef = useRef(false);
  useEffect(() => {
    didAutoFixRef.current = false;
  }, [flowId]);

  // Build node index map for numbering (excluding start node)
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
    },
  }), [nodeIndexMap]);

  const initialNodes = useMemo(() => 
    dbNodes.map(createNodeData) as FlowEditorNode[], 
    [dbNodes, createNodeData]
  );

  // Convert DB edges to React Flow format - clean straight vertical edges
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
    const mapped = dbNodes.map(createNodeData) as FlowEditorNode[];
    setNodes(mapped);
  }, [dbNodes, setNodes, createNodeData]);

  useEffect(() => {
    setEdges(
      (dbEdges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle,
        label: edge.label,
        animated: false,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
        style: { stroke: "#64748b", strokeWidth: 2 },
      })) as FlowEditorEdge[])
    );
  }, [dbEdges, setEdges]);

  // Auto-fix layout on load if needed - ALWAYS ensure vertical alignment
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (didAutoFixRef.current) return;
    if (dbNodes.length === 0) return;

    didAutoFixRef.current = true;

    // Check if layout needs reorganization (not centered or overlapping)
    const positions = dbNodes.map(n => ({ x: n.position_x, y: n.position_y }));
    const hasOverlap = positions.some((p1, i) => 
      positions.some((p2, j) => i !== j && Math.abs(p1.y - p2.y) < 100)
    );
    
    const notCentered = positions.some(p => Math.abs(p.x - LAYOUT.CENTER_X) > 50);
    const needsReorganization = hasOverlap || notCentered;

    if (!needsReorganization) return;

    // Apply vertical centered layout
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

    // Save the fixed layout
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
      toast.success("Layout organizado automaticamente!");
    });
  }, [dbNodes, dbEdges, loadingNodes, loadingEdges, setNodes, flowId, saveFlow, createNodeData]);

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

  // Add new node - VERTICAL layout, always below the last node, centered
  const handleAddNode = async (type: NodeType) => {
    const currentNodes = nodes;
    
    // Find the maximum Y position (lowest node on screen)
    let maxY = LAYOUT.START_Y - LAYOUT.GAP_Y;
    currentNodes.forEach((node) => {
      if (node.position.y > maxY) {
        maxY = node.position.y;
      }
    });

    // New node goes directly below, centered
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

  // Auto-organize layout - vertical centered
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

    toast.success("Layout reorganizado! Clique em 'Salvar' para persistir.");
  };

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Professional Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-slate-700" />
          <h2 className="text-lg font-semibold text-white">{flowName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoOrganize}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Organizar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveFlow.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      {/* Flow Editor Canvas */}
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
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-slate-950"
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
            style: { stroke: "#64748b", strokeWidth: 2 },
          }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={32} 
            size={1} 
            color="rgba(255,255,255,0.04)"
          />
          <Controls className="!bg-slate-800 !border-slate-700 !shadow-xl [&_button]:!bg-slate-700 [&_button]:!border-slate-600 [&_button]:hover:!bg-slate-600 [&_button_svg]:!fill-slate-300" />
          <MiniMap 
            className="!bg-slate-800 !border-slate-700 !shadow-xl"
            maskColor="rgba(0,0,0,0.8)"
            nodeColor={(node) => {
              switch (node.type) {
                case "start": return "#10b981";
                case "message": return "#0ea5e9";
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

          {/* Professional Add Step Panel */}
          <Panel position="top-center" className="!mt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="default" 
                  className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-xl px-6"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Etapa
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="center" 
                className="w-72 bg-slate-800 border-slate-700 shadow-2xl p-2"
              >
                <div className="px-2 py-2 mb-2 border-b border-slate-700">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Selecione uma ação</p>
                </div>
                <div className="grid gap-1">
                  {availableNodeTypes.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <DropdownMenuItem
                        key={nodeType.type}
                        onClick={() => handleAddNode(nodeType.type as NodeType)}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer text-slate-200 hover:bg-slate-700 focus:bg-slate-700 rounded-lg"
                      >
                        <div className={cn("p-2 rounded-lg", nodeType.bgColor)}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="font-medium block">{nodeType.label}</span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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
 * Vertical layout algorithm (Professional: top to bottom, centered)
 * - Start node at top center
 * - Other nodes ordered by creation date, stacked vertically
 * - All nodes centered on same X axis
 */
function computeVerticalLayout(
  nodes: Array<{ id: string; node_type: string; created_at: string; position_x: number; position_y: number }>
): Map<string, { x: number; y: number }> {
  const newPositions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return newPositions;

  // Sort: start first, then by creation date
  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.node_type === "start") return -1;
    if (b.node_type === "start") return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  // Position vertically, all centered on same X
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
