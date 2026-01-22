import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  MessageSquare, 
  HelpCircle, 
  GitBranch, 
  Clock, 
  Zap, 
  UserCheck, 
  Flag,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useChatbotFlowEditor, NodeType, ChatbotFlowNode, ChatbotFlowEdge } from "@/hooks/useChatbotFlows";

// Node components
import StartNode from "./nodes/StartNode";
import MessageNode from "./nodes/MessageNode";
import QuestionNode from "./nodes/QuestionNode";
import ConditionNode from "./nodes/ConditionNode";
import DelayNode from "./nodes/DelayNode";
import ActionNode from "./nodes/ActionNode";
import TransferNode from "./nodes/TransferNode";
import EndNode from "./nodes/EndNode";
import CustomEdge from "./edges/CustomEdge";

const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  delay: DelayNode,
  action: ActionNode,
  transfer: TransferNode,
  end: EndNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const nodeOptions: { type: NodeType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "message", label: "Mensagem", icon: MessageSquare, color: "text-blue-500" },
  { type: "question", label: "Pergunta", icon: HelpCircle, color: "text-purple-500" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "text-amber-500" },
  { type: "delay", label: "Delay", icon: Clock, color: "text-cyan-500" },
  { type: "action", label: "Ação", icon: Zap, color: "text-violet-500" },
  { type: "transfer", label: "Transferir", icon: UserCheck, color: "text-rose-500" },
  { type: "end", label: "Fim", icon: Flag, color: "text-slate-500" },
];

interface FlowBuilderCanvasProps {
  flowId: string;
  flowName: string;
  onClose: () => void;
}

function FlowBuilderCanvasInner({ flowId, flowName, onClose }: FlowBuilderCanvasProps) {
  const { nodes: dbNodes, edges: dbEdges, loadingNodes, loadingEdges, addNode, updateNode, deleteNode, addEdge: addDbEdge, deleteEdge } = useChatbotFlowEditor(flowId);
  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow();
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Stable refs
  const dbEdgesRef = useRef(dbEdges);
  const updateNodeRef = useRef(updateNode);
  const dbNodesRef = useRef(dbNodes);
  dbEdgesRef.current = dbEdges;
  updateNodeRef.current = updateNode;
  dbNodesRef.current = dbNodes;

  // Callbacks
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    await deleteNode.mutateAsync(nodeId);
    toast.success("Bloco removido!");
  }, [deleteNode]);

  const handleUpdateNode = useCallback((nodeId: string, newConfig: Record<string, unknown>) => {
    updateNodeRef.current.mutate({ id: nodeId, config: newConfig });
  }, []);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await deleteEdge.mutateAsync(edgeId);
  }, [deleteEdge]);

  // Handle adding node from handle "+" button (ManyChat style)
  const handleAddNodeFromHandle = useCallback(async (
    nodeType: NodeType,
    sourceNodeId: string,
    sourceHandle?: string
  ) => {
    const sourceNode = dbNodesRef.current.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Calculate position to the right
    let x = sourceNode.position_x + 350;
    let y = sourceNode.position_y;

    // Offset if there are already edges from this source
    const existingEdgesFromSource = dbEdgesRef.current.filter(
      e => e.source_node_id === sourceNodeId && e.source_handle === (sourceHandle || null)
    );
    if (existingEdgesFromSource.length > 0) {
      y = sourceNode.position_y + (existingEdgesFromSource.length * 150);
    }

    // Create the new node
    const newNode = await addNode.mutateAsync({
      node_type: nodeType,
      position_x: x,
      position_y: y,
      config: {},
    });

    // Connect to source
    await addDbEdge.mutateAsync({
      source_node_id: sourceNodeId,
      target_node_id: newNode.id,
      source_handle: sourceHandle || undefined,
    });

    setSelectedNodeId(newNode.id);
    toast.success("Bloco adicionado!");
  }, [addNode, addDbEdge]);

  const handleInsertNodeOnEdge = useCallback(async (
    edgeId: string,
    sourceId: string,
    targetId: string,
    nodeType: NodeType,
    position: { x: number; y: number }
  ) => {
    // Delete the original edge
    await deleteEdge.mutateAsync(edgeId);
    
    // Create new node
    const newNode = await addNode.mutateAsync({
      node_type: nodeType,
      position_x: position.x,
      position_y: position.y,
      config: {},
    });

    // Create edges: source -> new node -> target
    await addDbEdge.mutateAsync({
      source_node_id: sourceId,
      target_node_id: newNode.id,
    });
    await addDbEdge.mutateAsync({
      source_node_id: newNode.id,
      target_node_id: targetId,
    });

    toast.success("Bloco inserido!");
  }, [deleteEdge, addNode, addDbEdge]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Check if start node has connections
  const startNodeHasConnections = useMemo(() => {
    const startNode = dbNodes.find(n => n.node_type === "start");
    if (!startNode) return false;
    return dbEdges.some(e => e.source_node_id === startNode.id);
  }, [dbNodes, dbEdges]);

  // Sync DB nodes to React Flow
  useEffect(() => {
    const rfNodes: Node[] = dbNodes.map((node) => {
      const config = node.config as Record<string, unknown>;
      const isStartNode = node.node_type === "start";
      
      return {
        id: node.id,
        type: node.node_type,
        position: { x: node.position_x, y: node.position_y },
        data: {
          ...config,
          hasConnections: isStartNode ? startNodeHasConnections : undefined,
          onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(node.id, newConfig),
          onDelete: node.node_type !== "start" ? () => handleDeleteNode(node.id) : undefined,
          onAddNode: handleAddNodeFromHandle,
        },
      };
    });
    setNodes(rfNodes);
  }, [dbNodes, setNodes, handleUpdateNode, handleDeleteNode, handleAddNodeFromHandle, startNodeHasConnections]);

  // Sync DB edges to React Flow
  useEffect(() => {
    const rfEdges: Edge[] = dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle || undefined,
      type: "custom",
      animated: true,
      data: {
        onDelete: () => handleDeleteEdge(edge.id),
        onInsertNode: (nodeType: NodeType, position: { x: number; y: number }) => {
          handleInsertNodeOnEdge(edge.id, edge.source_node_id, edge.target_node_id, nodeType, position);
        },
      },
    }));
    setEdges(rfEdges);
  }, [dbEdges, setEdges, handleDeleteEdge, handleInsertNodeOnEdge]);

  // Handle new connections
  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return;
    
    // Check for existing edge
    const exists = dbEdgesRef.current.some(
      (e) => e.source_node_id === params.source && e.target_node_id === params.target
    );
    if (exists) return;

    await addDbEdge.mutateAsync({
      source_node_id: params.source,
      target_node_id: params.target,
      source_handle: params.sourceHandle || undefined,
    });
  }, [addDbEdge]);

  // Handle node drag stop - save position
  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    updateNode.mutate({
      id: node.id,
      position_x: Math.round(node.position.x),
      position_y: Math.round(node.position.y),
    });
  }, [updateNode]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Handle pane click to deselect
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Add new node with auto-connection
  const handleAddNode = async (type: NodeType) => {
    // Find the source node to connect from
    let sourceNodeId: string | null = null;
    let sourceNode: ChatbotFlowNode | undefined;

    if (selectedNodeId) {
      // Use selected node
      sourceNode = dbNodesRef.current.find(n => n.id === selectedNodeId);
      sourceNodeId = selectedNodeId;
    } else {
      // Find start node
      sourceNode = dbNodesRef.current.find(n => n.node_type === "start");
      sourceNodeId = sourceNode?.id || null;
    }

    // Calculate position
    let x = 400;
    let y = 200;
    
    if (sourceNode) {
      // Position to the right of source node
      x = sourceNode.position_x + 350;
      y = sourceNode.position_y;
      
      // Check if there are already nodes connected from source
      const existingEdgesFromSource = dbEdgesRef.current.filter(e => e.source_node_id === sourceNodeId);
      if (existingEdgesFromSource.length > 0) {
        // Offset y position for each existing connection
        y = sourceNode.position_y + (existingEdgesFromSource.length * 150);
      }
    }

    // Create the new node
    const newNode = await addNode.mutateAsync({
      node_type: type,
      position_x: x,
      position_y: y,
      config: {},
    });

    // Auto-connect to source node if available
    if (sourceNodeId) {
      await addDbEdge.mutateAsync({
        source_node_id: sourceNodeId,
        target_node_id: newNode.id,
      });
    }

    // Select the new node
    setSelectedNodeId(newNode.id);
    
    toast.success("Bloco adicionado e conectado!");
  };

  // Loading state
  if (loadingNodes || loadingEdges) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "custom",
          animated: true,
        }}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        className="bg-slate-900"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="#374151" 
        />
        
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-slate-800 !border-slate-700 rounded-lg"
          maskColor="rgba(0,0,0,0.5)"
        />

        {/* Top Panel */}
        <Panel position="top-left" className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
            <h2 className="font-semibold text-white">{flowName}</h2>
          </div>
        </Panel>

        {/* Add Node Button */}
        <Panel position="top-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600">
                <Plus className="w-4 h-4" />
                Adicionar Bloco
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {nodeOptions.map((option) => (
                <DropdownMenuItem
                  key={option.type}
                  onClick={() => handleAddNode(option.type)}
                  className="gap-2"
                >
                  <option.icon className={`w-4 h-4 ${option.color}`} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>

        {/* Zoom Controls */}
        <Panel position="bottom-right" className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => zoomIn()}
            className="h-8 w-8"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => zoomOut()}
            className="h-8 w-8"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => fitView({ padding: 0.2 })}
            className="h-8 w-8"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </Panel>

        <Controls 
          showZoom={false} 
          showFitView={false}
          className="!bg-slate-800 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

export function FlowBuilderCanvas(props: FlowBuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
