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

  // Placement helpers (avoid stacked nodes when user adds quickly)
  const nodesRef = useRef<Node[]>([]);
  const placementAnchorIdRef = useRef<string | null>(null);
  const lastPlacedRef = useRef<{ x: number; y: number } | null>(null);
  const NODE_GAP_Y = 140;

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

  // Auto-correção: se detectar que o "Início" não está no topo (ou nós sobrepostos), aplica um layout
  // determinístico para abrir o fluxo sempre organizado.
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (didAutoFixRef.current) return;
    if (dbNodes.length === 0) return;

    const start = dbNodes.find((n) => n.node_type === "start");
    if (!start) return;

    const minY = Math.min(...dbNodes.map((n) => n.position_y));
    const startNotTop = start.position_y > minY;

    const positionKey = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;
    const seen = new Set<string>();
    let hasOverlap = false;
    for (const n of dbNodes) {
      const k = positionKey(n.position_x, n.position_y);
      if (seen.has(k)) {
        hasOverlap = true;
        break;
      }
      seen.add(k);
    }

    if (!startNotTop && !hasOverlap) return;

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

    const mappedEdges: FlowEditorEdge[] = dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      label: edge.label,
      animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    }));

    const newPositions = computeDeterministicLayout(mappedNodes, mappedEdges);
    if (newPositions.size === 0) return;

    didAutoFixRef.current = true;

    setNodes(
      mappedNodes.map((node) => {
        const pos = newPositions.get(node.id);
        return pos ? { ...node, position: pos } : node;
      })
    );
    setEdges(mappedEdges);

    const maxY = Math.max(...Array.from(newPositions.values()).map((p) => p.y));
    lastPlacedRef.current = { x: 300, y: maxY };

    toast.success("Layout ajustado automaticamente. Clique em 'Salvar Fluxo' para manter.");
  }, [dbNodes, dbEdges, loadingNodes, loadingEdges, setNodes, setEdges]);

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

  // Add new node
  const handleAddNode = async (type: NodeType) => {
    // IMPORTANT: ReactFlow positions can be floats while dragging/zooming,
    // but our DB columns expect integers. Always round before inserting.
    const currentNodes = nodesRef.current;

    // Prefer placing below the last clicked node; fallback to bottom-most node.
    const anchor = placementAnchorIdRef.current
      ? currentNodes.find((n) => n.id === placementAnchorIdRef.current) || null
      : null;

    const bottomMost = currentNodes.length
      ? currentNodes.reduce((prev, curr) => (prev.position.y > curr.position.y ? prev : curr))
      : null;

    const baseX = Math.round(
      anchor?.position.x ??
        lastPlacedRef.current?.x ??
        bottomMost?.position.x ??
        250
    );

    // If user clicks add quickly, rely on lastPlacedRef to avoid stacking while DB refetch is pending.
    let nextY = Math.round(
      anchor?.position.y != null
        ? anchor.position.y + NODE_GAP_Y
        : (lastPlacedRef.current?.y ?? bottomMost?.position.y ?? 50) + NODE_GAP_Y
    );

    // Simple collision avoidance: if there's already a node at (x,y), push down.
    const isOccupied = (x: number, y: number) =>
      currentNodes.some((n) => Math.abs(n.position.x - x) < 10 && Math.abs(n.position.y - y) < 10);
    while (isOccupied(baseX, nextY)) nextY += NODE_GAP_Y;

    // Reserve slot immediately (prevents overlap on rapid clicks)
    lastPlacedRef.current = { x: baseX, y: nextY };

    try {
      await addNode.mutateAsync({
        node_type: type,
        position_x: baseX,
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

  // Auto-organize layout using BFS from start node
  const handleAutoOrganize = () => {
    const currentNodes = nodesRef.current;
    const currentEdges = edges;

    const START_X = 300;

    if (currentNodes.length === 0) return;

    const newPositions = computeDeterministicLayout(currentNodes, currentEdges);
    if (newPositions.size === 0) {
      toast.error("Nó de início não encontrado");
      return;
    }

    // Apply new positions to local state
    setNodes((prev) =>
      prev.map((node) => {
        const pos = newPositions.get(node.id);
        if (pos) {
          return { ...node, position: pos };
        }
        return node;
      })
    );

    // Update lastPlacedRef
    const maxY = Math.max(...Array.from(newPositions.values()).map((p) => p.y));
    lastPlacedRef.current = { x: START_X, y: maxY };

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
          onNodeClick={(_, node) => {
            placementAnchorIdRef.current = node.id;
          }}
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

function compareNodesForLayout(a?: FlowEditorNode | Node, b?: FlowEditorNode | Node) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  if (a.type === "start" && b.type !== "start") return -1;
  if (b.type === "start" && a.type !== "start") return 1;

  const aCreated = (a.data as any)?.createdAt as string | undefined;
  const bCreated = (b.data as any)?.createdAt as string | undefined;
  if (aCreated && bCreated && aCreated !== bCreated) return aCreated.localeCompare(bCreated);
  return a.id.localeCompare(b.id);
}

function computeDeterministicLayout(currentNodes: (FlowEditorNode | Node)[], currentEdges: (FlowEditorEdge | Edge)[]) {
  if (currentNodes.length === 0) return new Map<string, { x: number; y: number }>();

  const startNode = currentNodes.find((n) => (n as any).type === "start") as (FlowEditorNode | Node) | undefined;
  if (!startNode) return new Map<string, { x: number; y: number }>();

  const nodesById = new Map(currentNodes.map((n) => [n.id, n] as const));

  // Build adjacency map: source -> targets[]
  const adjacency = new Map<string, string[]>();
  currentEdges.forEach((edge: any) => {
    if (!edge?.source || !edge?.target) return;
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  });

  // Sort children deterministically
  for (const [src, targets] of adjacency.entries()) {
    targets.sort((aId, bId) => compareNodesForLayout(nodesById.get(aId), nodesById.get(bId)));
    adjacency.set(src, targets);
  }

  // BFS to assign levels
  const levels = new Map<string, number>();
  const startId = startNode.id;
  const queue: string[] = [startId];
  levels.set(startId, 0);

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const level = levels.get(id) ?? 0;
    const children = adjacency.get(id) || [];
    for (const childId of children) {
      if (!levels.has(childId)) {
        levels.set(childId, level + 1);
        queue.push(childId);
      }
    }
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, Node[]>();
  currentNodes.forEach((node) => {
    const lvl = levels.get(node.id) ?? 999; // unconnected nodes go to the end
    const arr = nodesByLevel.get(lvl) || [];
    arr.push(node);
    nodesByLevel.set(lvl, arr);
  });

  // Layout constants
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 80;
  const GAP_X = 60;
  const GAP_Y = 120;
  const START_X = 300;
  const START_Y = 60;

  // Compute new positions
  const newPositions = new Map<string, { x: number; y: number }>();
  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);

  sortedLevels.forEach((level) => {
    const nodesAtLevel = nodesByLevel.get(level)!;
    nodesAtLevel.sort(compareNodesForLayout);

    // Garantia extra: o "Início" fica sozinho no nível 0, no topo.
    const finalNodesAtLevel =
      level === 0
        ? nodesAtLevel.sort(compareNodesForLayout).filter((n) => n.type === "start")
        : nodesAtLevel;

    const totalWidth =
      finalNodesAtLevel.length * NODE_WIDTH + (finalNodesAtLevel.length - 1) * GAP_X;
    let x = START_X - totalWidth / 2 + NODE_WIDTH / 2;
    const y = START_Y + level * (NODE_HEIGHT + GAP_Y);

    finalNodesAtLevel.forEach((node) => {
      newPositions.set(node.id, { x: Math.round(x), y: Math.round(y) });
      x += NODE_WIDTH + GAP_X;
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
