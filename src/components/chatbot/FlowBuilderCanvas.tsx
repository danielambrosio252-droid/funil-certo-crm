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
  Connection,
  Node,
  Edge,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Plus, 
  MessageSquare, 
  HelpCircle, 
  GitBranch, 
  Clock, 
  Pause,
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
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useChatbotFlowEditor, useChatbotFlows, NodeType, ChatbotFlowNode } from "@/hooks/useChatbotFlows";
import { SelectionContextMenu } from "./SelectionContextMenu";

// Node components
import StartNode from "./nodes/StartNode";
import MessageNode from "./nodes/MessageNode";
import QuestionNode from "./nodes/QuestionNode";
import ConditionNode from "./nodes/ConditionNode";
import DelayNode from "./nodes/DelayNode";
import PauseNode from "./nodes/PauseNode";
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
  pause: PauseNode,
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
  { type: "pause", label: "Pausa", icon: Pause, color: "text-orange-500" },
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
  const { nodes: dbNodes, edges: dbEdges, loadingNodes, loadingEdges, addNode, updateNode, deleteNode, addEdge: addDbEdge, deleteEdge, ensureStartNode } = useChatbotFlowEditor(flowId);
  const { flows, updateFlow } = useChatbotFlows();
  const { fitView, zoomIn, zoomOut, getViewport, screenToFlowPosition } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const hasEnsuredStartNode = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Get current flow data for trigger configuration
  const currentFlow = flows.find(f => f.id === flowId);

  // Stable refs
  const dbEdgesRef = useRef(dbEdges);
  const updateNodeRef = useRef(updateNode);
  const dbNodesRef = useRef(dbNodes);
  dbEdgesRef.current = dbEdges;
  updateNodeRef.current = updateNode;
  dbNodesRef.current = dbNodes;

  // Handle updating flow triggers from StartNode
  const handleUpdateTriggers = useCallback((keywords: string[], isDefault: boolean) => {
    updateFlow.mutate({
      id: flowId,
      trigger_keywords: keywords,
      is_active: isDefault ? true : undefined, // Default flows should be active
    });
    // Note: is_default is managed at flow level, but we store trigger config
  }, [flowId, updateFlow]);

  // CRITICAL FAILSAFE: Ensure Start node always exists
  useEffect(() => {
    const checkAndCreateStartNode = async () => {
      // Wait for loading to complete
      if (loadingNodes) return;
      
      // Only try once per mount
      if (hasEnsuredStartNode.current) return;
      hasEnsuredStartNode.current = true;
      
      // Check if start node exists
      const hasStartNode = dbNodes.some(n => n.node_type === "start");
      
      if (!hasStartNode) {
        console.log("[FlowBuilder] No start node found, creating one...");
        try {
          await ensureStartNode();
          console.log("[FlowBuilder] Start node created successfully");
        } catch (error) {
          console.error("[FlowBuilder] Failed to create start node:", error);
          // Allow retry on next mount
          hasEnsuredStartNode.current = false;
        }
      }
    };
    
    checkAndCreateStartNode();
  }, [loadingNodes, dbNodes.length, ensureStartNode]);

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

  // React Flow state (declared early so we can use setters in callbacks)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Ref for handleInsertNodeOnEdge to break circular dependency
  const handleInsertNodeOnEdgeRef = useRef<(
    edgeId: string,
    sourceId: string,
    targetId: string,
    nodeType: NodeType,
    position: { x: number; y: number }
  ) => Promise<void>>();

  // handleInsertNodeOnEdge MUST be declared BEFORE handleAddNodeFromHandle
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
      position_x: Math.round(position.x),
      position_y: Math.round(position.y),
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

  // Keep ref updated
  handleInsertNodeOnEdgeRef.current = handleInsertNodeOnEdge;

  // Handle adding node from handle "+" button (ManyChat style)
  const handleAddNodeFromHandle = useCallback(async (
    nodeType: NodeType,
    sourceNodeId: string,
    sourceHandle?: string
  ) => {
    const sourceNode = dbNodesRef.current.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Calculate position to the right of source node (guaranteed visible)
    let x = Number(sourceNode.position_x) + 350;
    let y = Number(sourceNode.position_y);

    // Failsafe: if positions are invalid, drop near viewport center
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const viewport = getViewport();
      const rect = wrapperRef.current?.getBoundingClientRect();
      const fallback = rect
        ? {
            x: (-viewport.x + rect.width / 2) / viewport.zoom,
            y: (-viewport.y + rect.height / 2) / viewport.zoom,
          }
        : { x: 400, y: 200 };
      x = fallback.x + 200;
      y = fallback.y;
    }

    // Offset if there are already edges from this source
    const existingEdgesFromSource = dbEdgesRef.current.filter(
      e => e.source_node_id === sourceNodeId && e.source_handle === (sourceHandle || null)
    );
    if (existingEdgesFromSource.length > 0) {
      y = Number(sourceNode.position_y) + (existingEdgesFromSource.length * 150);
    }

    // Create the new node (DB) + optimistic render (STATE)
    const newNode = await addNode.mutateAsync({
      node_type: nodeType,
      position_x: Math.round(x),
      position_y: Math.round(y),
      config: {},
    });

    // Optimistic: render immediately in canvas state
    setNodes((nds) => {
      const next = nds
        .filter((n) => n.id !== newNode.id)
        .map((n) => ({ ...n, selected: false }));
      next.push({
        id: newNode.id,
        type: newNode.node_type,
        position: { x: newNode.position_x, y: newNode.position_y },
        selected: true,
        data: {
          ...(newNode.config as Record<string, unknown>),
          onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(newNode.id, newConfig),
          onDelete: newNode.node_type !== "start" ? () => handleDeleteNode(newNode.id) : undefined,
          onAddNode: handleAddNodeFromHandle,
        },
      });
      return next;
    });

    // Connect to source
    const createdEdge = await addDbEdge.mutateAsync({
      source_node_id: sourceNodeId,
      target_node_id: newNode.id,
      source_handle: sourceHandle || undefined,
    });

    // Optimistic: render edge immediately
    setEdges((eds) => {
      const next = eds.filter((e) => e.id !== createdEdge.id);
      next.push({
        id: createdEdge.id,
        source: createdEdge.source_node_id,
        target: createdEdge.target_node_id,
        sourceHandle: createdEdge.source_handle || undefined,
        type: "custom",
        animated: true,
        data: {
          onDelete: () => handleDeleteEdge(createdEdge.id),
          onInsertNode: (t: NodeType, pos: { x: number; y: number }) => {
            handleInsertNodeOnEdgeRef.current?.(createdEdge.id, createdEdge.source_node_id, createdEdge.target_node_id, t, pos);
          },
        },
      });
      return next;
    });

    setSelectedNodeId(newNode.id);
    // Keep the new node in view
    requestAnimationFrame(() => {
      try {
        fitView({ padding: 0.35 });
      } catch {
        // noop
      }
    });
    toast.success("Bloco adicionado!");
  }, [addNode, addDbEdge, fitView, getViewport, handleDeleteEdge, handleDeleteNode, handleUpdateNode, setNodes, setEdges]);


  // Check if start node has connections
  const startNodeHasConnections = useMemo(() => {
    const startNode = dbNodes.find(n => n.node_type === "start");
    if (!startNode) return false;
    return dbEdges.some(e => e.source_node_id === startNode.id);
  }, [dbNodes, dbEdges]);

  // Sync DB -> STATE (single source of truth for rendering)
  // ALWAYS sync data/config changes so node updates (like adding options) reflect immediately
  useEffect(() => {
    // Build a map for quick lookup
    const dbNodeMap = new Map(dbNodes.map((n) => [n.id, n]));
    
    setNodes((currentNodes) => {
      const currentIds = new Set(currentNodes.map((n) => n.id));
      const dbIds = new Set(dbNodes.map((n) => n.id));
      
      // If IDs differ, rebuild entire array
      const idsMatch = currentIds.size === dbIds.size && [...currentIds].every((id) => dbIds.has(id));
      
      if (!idsMatch) {
        // Full rebuild
        return dbNodes.map((node) => {
          const config = node.config as Record<string, unknown>;
          const isStartNode = node.node_type === "start";
          const x = Number(node.position_x);
          const y = Number(node.position_y);
          const safePos = {
            x: Number.isFinite(x) ? x : 400,
            y: Number.isFinite(y) ? y : 200,
          };

          return {
            id: node.id,
            type: node.node_type,
            position: safePos,
            selected: node.id === selectedNodeId,
            data: {
              ...config,
              hasConnections: isStartNode ? startNodeHasConnections : undefined,
              // Pass trigger config to StartNode
              triggerKeywords: isStartNode ? (currentFlow?.trigger_keywords || []) : undefined,
              isDefault: isStartNode ? (currentFlow?.is_default || false) : undefined,
              onUpdateTriggers: isStartNode ? handleUpdateTriggers : undefined,
              onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(node.id, newConfig),
              onDelete: node.node_type !== "start" ? () => handleDeleteNode(node.id) : undefined,
              onAddNode: handleAddNodeFromHandle,
            },
          };
        });
      }
      
      // IDs match - update data/config for each node
      return currentNodes.map((rfNode) => {
        const dbNode = dbNodeMap.get(rfNode.id);
        if (!dbNode) return rfNode;
        
        const config = dbNode.config as Record<string, unknown>;
        const isStartNode = dbNode.node_type === "start";
        
        return {
          ...rfNode,
          selected: rfNode.id === selectedNodeId,
          data: {
            ...config,
            hasConnections: isStartNode ? startNodeHasConnections : undefined,
            // Pass trigger config to StartNode
            triggerKeywords: isStartNode ? (currentFlow?.trigger_keywords || []) : undefined,
            isDefault: isStartNode ? (currentFlow?.is_default || false) : undefined,
            onUpdateTriggers: isStartNode ? handleUpdateTriggers : undefined,
            onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(dbNode.id, newConfig),
            onDelete: dbNode.node_type !== "start" ? () => handleDeleteNode(dbNode.id) : undefined,
            onAddNode: handleAddNodeFromHandle,
          },
        };
      });
    });
  }, [dbNodes, selectedNodeId, setNodes, handleUpdateNode, handleDeleteNode, handleAddNodeFromHandle, startNodeHasConnections, currentFlow, handleUpdateTriggers]);

  // Sync DB edges -> STATE (guarded)
  useEffect(() => {
    const dbIds = new Set(dbEdges.map((e) => e.id));
    const localIds = new Set(edges.map((e) => e.id));
    const isSameSet = dbIds.size === localIds.size && [...dbIds].every((id) => localIds.has(id));
    if (!isSameSet) {
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
    }
  }, [dbEdges, edges, setEdges, handleDeleteEdge, handleInsertNodeOnEdge]);

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
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
  }, []);

  // Handle pane click to deselect
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // If we're in moving mode, move the selected nodes to clicked position
    if (isMovingSelection && selectedNodes.length > 0) {
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      
      // Calculate the center of the selection
      const minX = Math.min(...selectedNodes.map(n => n.position.x));
      const minY = Math.min(...selectedNodes.map(n => n.position.y));
      
      // Calculate offset from click to top-left of selection
      const offsetX = flowPosition.x - minX;
      const offsetY = flowPosition.y - minY;
      
      // Move all selected nodes
      selectedNodes.forEach(node => {
        const newX = Math.round(node.position.x + offsetX);
        const newY = Math.round(node.position.y + offsetY);
        updateNode.mutate({
          id: node.id,
          position_x: newX,
          position_y: newY,
        });
      });
      
      setIsMovingSelection(false);
      setContextMenuPosition(null);
      setSelectedNodes([]);
      toast.success(`${selectedNodes.length} blocos movidos!`);
      return;
    }
    
    setSelectedNodeId(null);
    setSelectedNodes([]);
    setContextMenuPosition(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
  }, [isMovingSelection, selectedNodes, screenToFlowPosition, updateNode, setNodes]);

  // Handle selection change (for multi-select)
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const selected = params.nodes.filter(n => n.type !== "start"); // Don't include start node in selection
    setSelectedNodes(selected);
    
    if (selected.length > 1) {
      // Show context menu near the selection
      const centerX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length;
      const centerY = Math.min(...selected.map(n => n.position.y));
      
      // Convert to screen coordinates
      const viewport = getViewport();
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const screenX = centerX * viewport.zoom + viewport.x + rect.left;
        const screenY = centerY * viewport.zoom + viewport.y + rect.top - 20;
        setContextMenuPosition({ x: screenX, y: screenY });
      }
    } else {
      setContextMenuPosition(null);
    }
  }, [getViewport]);

  // Handle copy selected nodes
  const handleCopySelectedNodes = useCallback(async () => {
    if (selectedNodes.length === 0) return;
    
    const offset = 100;
    const nodeIdMap = new Map<string, string>();
    
    // Create copies of all selected nodes
    for (const node of selectedNodes) {
      if (node.type === "start") continue;
      
      const dbNode = dbNodesRef.current.find(n => n.id === node.id);
      if (!dbNode) continue;
      
      const newNode = await addNode.mutateAsync({
        node_type: dbNode.node_type as NodeType,
        position_x: Math.round(node.position.x + offset),
        position_y: Math.round(node.position.y + offset),
        config: dbNode.config as Record<string, unknown>,
      });
      
      nodeIdMap.set(node.id, newNode.id);
    }
    
    // Copy edges between selected nodes
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = dbEdgesRef.current.filter(
      e => selectedIds.has(e.source_node_id) && selectedIds.has(e.target_node_id)
    );
    
    for (const edge of internalEdges) {
      const newSourceId = nodeIdMap.get(edge.source_node_id);
      const newTargetId = nodeIdMap.get(edge.target_node_id);
      
      if (newSourceId && newTargetId) {
        await addDbEdge.mutateAsync({
          source_node_id: newSourceId,
          target_node_id: newTargetId,
          source_handle: edge.source_handle || undefined,
        });
      }
    }
    
    setSelectedNodes([]);
    setContextMenuPosition(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    toast.success(`${selectedNodes.length} blocos copiados!`);
  }, [selectedNodes, addNode, addDbEdge, setNodes]);

  // Handle start move mode
  const handleStartMoveMode = useCallback(() => {
    setIsMovingSelection(true);
    toast.info("Clique no canvas para mover os blocos selecionados");
  }, []);

  // Handle delete selected nodes
  const handleDeleteSelectedNodes = useCallback(async () => {
    if (selectedNodes.length === 0) return;
    
    for (const node of selectedNodes) {
      if (node.type !== "start") {
        await deleteNode.mutateAsync(node.id);
      }
    }
    
    setSelectedNodes([]);
    setContextMenuPosition(null);
    toast.success(`${selectedNodes.length} blocos removidos!`);
  }, [selectedNodes, deleteNode]);

  // Handle cancel selection
  const handleCancelSelection = useCallback(() => {
    setSelectedNodes([]);
    setContextMenuPosition(null);
    setIsMovingSelection(false);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
  }, [setNodes]);

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

    // Calculate position (guaranteed visible)
    const viewport = getViewport();
    const rect = wrapperRef.current?.getBoundingClientRect();
    const center = rect
      ? {
          x: (-viewport.x + rect.width / 2) / viewport.zoom,
          y: (-viewport.y + rect.height / 2) / viewport.zoom,
        }
      : { x: 400, y: 200 };

    let x = center.x + 200;
    let y = center.y;
    
    if (sourceNode) {
      // Position to the right of source node
      x = Number(sourceNode.position_x) + 350;
      y = Number(sourceNode.position_y);
      
      // Check if there are already nodes connected from source
      const existingEdgesFromSource = dbEdgesRef.current.filter(e => e.source_node_id === sourceNodeId);
      if (existingEdgesFromSource.length > 0) {
        // Offset y position for each existing connection
        y = sourceNode.position_y + (existingEdgesFromSource.length * 150);
      }
    }

    // Final failsafe for invalid numbers
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      x = 400;
      y = 200;
    }

    // Create the new node
    const newNode = await addNode.mutateAsync({
      node_type: type,
      position_x: x,
      position_y: y,
      config: {},
    });

    // Optimistic: render immediately
    setNodes((nds) => {
      const next = nds
        .filter((n) => n.id !== newNode.id)
        .map((n) => ({ ...n, selected: false }));
      next.push({
        id: newNode.id,
        type: newNode.node_type,
        position: { x: newNode.position_x, y: newNode.position_y },
        selected: true,
        data: {
          ...(newNode.config as Record<string, unknown>),
          onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(newNode.id, newConfig),
          onDelete: newNode.node_type !== "start" ? () => handleDeleteNode(newNode.id) : undefined,
          onAddNode: handleAddNodeFromHandle,
        },
      });
      return next;
    });

    // Auto-connect to source node if available
    if (sourceNodeId) {
      const createdEdge = await addDbEdge.mutateAsync({
        source_node_id: sourceNodeId,
        target_node_id: newNode.id,
      });

      setEdges((eds) => {
        const next = eds.filter((e) => e.id !== createdEdge.id);
        next.push({
          id: createdEdge.id,
          source: createdEdge.source_node_id,
          target: createdEdge.target_node_id,
          sourceHandle: createdEdge.source_handle || undefined,
          type: "custom",
          animated: true,
          data: {
            onDelete: () => handleDeleteEdge(createdEdge.id),
            onInsertNode: (t: NodeType, position: { x: number; y: number }) => {
              handleInsertNodeOnEdge(createdEdge.id, createdEdge.source_node_id, createdEdge.target_node_id, t, position);
            },
          },
        });
        return next;
      });
    }

    // Select the new node
    setSelectedNodeId(newNode.id);
    requestAnimationFrame(() => {
      try {
        fitView({ padding: 0.35 });
      } catch {
        // noop
      }
    });
    
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
    <div ref={wrapperRef} className="h-full w-full bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "custom",
          animated: true,
        }}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        panOnScroll
        panOnDrag={false}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        className={`bg-slate-900 ${isMovingSelection ? 'cursor-crosshair' : ''}`}
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
        <Panel position="top-left" className="flex items-center gap-3 z-50">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="gap-2 relative z-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
            <h2 className="font-semibold text-white">{flowName}</h2>
          </div>
        </Panel>

        {/* DEBUG UX: Visible state counter */}
        <Panel position="top-right" className="pointer-events-none">
          <div className="px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white text-xs">
            <div className="font-medium">Nodes no estado: {nodes.length}</div>
            <div className="text-white/70">Edges no estado: {edges.length}</div>
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

      {/* Selection Context Menu */}
      {contextMenuPosition && selectedNodes.length > 0 && (
        <SelectionContextMenu
          selectedCount={selectedNodes.length}
          position={contextMenuPosition}
          onCopy={handleCopySelectedNodes}
          onMove={handleStartMoveMode}
          onDelete={handleDeleteSelectedNodes}
          onCancel={handleCancelSelection}
          isMoving={isMovingSelection}
        />
      )}
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
