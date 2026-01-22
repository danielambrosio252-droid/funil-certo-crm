import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Plus, 
  MessageSquare, 
  Zap, 
  Clock, 
  GitBranch, 
  Shuffle,
  AlignCenter,
  Save,
} from "lucide-react";

import TriggerNode from "./nodes/TriggerNode";
import MessageNode from "./nodes/MessageNode";
import DelayNode from "./nodes/DelayNode";
import ConditionNode from "./nodes/ConditionNode";

import { useFlowEditor, NodeType } from "@/hooks/useWhatsAppFlows";
import { toast } from "sonner";

interface FlowCanvasProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

// Custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  delay: DelayNode,
  condition: ConditionNode,
};

function FlowCanvasInner({ flowId, flowName, onBack }: FlowCanvasProps) {
  const { 
    nodes: dbNodes, 
    edges: dbEdges, 
    loadingNodes, 
    addNode, 
    updateNode, 
    deleteNode, 
    addEdge: addDbEdge, 
    deleteEdge,
  } = useFlowEditor(flowId);

  const { fitView } = useReactFlow();
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Stable refs for callbacks to avoid re-render loops
  const dbEdgesRef = useRef(dbEdges);
  const updateNodeRef = useRef(updateNode);
  dbEdgesRef.current = dbEdges;
  updateNodeRef.current = updateNode;
  
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    const connectedEdges = dbEdgesRef.current.filter(
      (e) => e.source_node_id === nodeId || e.target_node_id === nodeId
    );
    for (const edge of connectedEdges) {
      await deleteEdge.mutateAsync(edge.id);
    }
    await deleteNode.mutateAsync(nodeId);
    toast.success("Bloco removido!");
  }, [deleteEdge, deleteNode]);

  const handleUpdateNode = useCallback((nodeId: string, newConfig: Record<string, unknown>) => {
    updateNodeRef.current.mutate({ id: nodeId, config: newConfig });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync DB nodes to React Flow nodes
  useEffect(() => {
    const rfNodes: Node[] = dbNodes.map((node) => {
      const config = node.config as Record<string, unknown>;
      
      let nodeType = "message";
      if (node.node_type === "start") nodeType = "trigger";
      else if (node.node_type === "delay") nodeType = "delay";
      else if (node.node_type === "condition") nodeType = "condition";
      
      return {
        id: node.id,
        type: nodeType,
        position: { x: node.position_x, y: node.position_y },
        data: {
          ...config,
          trigger_type: config?.trigger_type,
          onUpdate: (newConfig: Record<string, unknown>) => handleUpdateNode(node.id, newConfig),
          onDelete: node.node_type !== "start" ? () => handleDeleteNode(node.id) : undefined,
        },
      };
    });
    setNodes(rfNodes);
  }, [dbNodes, setNodes, handleUpdateNode, handleDeleteNode]);

  // Sync DB edges to React Flow edges
  useEffect(() => {
    const rfEdges: Edge[] = dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle || undefined,
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }));
    setEdges(rfEdges);
  }, [dbEdges, setEdges]);


  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;
      
      try {
        await addDbEdge.mutateAsync({
          source_node_id: params.source,
          target_node_id: params.target,
          source_handle: params.sourceHandle || null,
        });
        setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#94a3b8", strokeWidth: 2 } }, eds));
      } catch (error: any) {
        toast.error("Erro ao conectar: " + error.message);
      }
    },
    [addDbEdge, setEdges]
  );

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await updateNode.mutateAsync({
        id: node.id,
        position_x: Math.round(node.position.x),
        position_y: Math.round(node.position.y),
      });
    },
    [updateNode]
  );

  const handleAddNode = useCallback(async (type: string) => {
    setShowAddMenu(false);
    
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
    }

    // Calculate position based on existing nodes
    const maxX = Math.max(...nodes.map((n) => n.position.x), 0);
    const centerY = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length 
      : 200;

    try {
      await addNode.mutateAsync({
        node_type: nodeType,
        position_x: Math.round(maxX + 450),
        position_y: Math.round(centerY),
        config,
      });
      toast.success("Bloco adicionado!");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  }, [addNode, nodes]);

  const handleCenterView = useCallback(() => {
    fitView({ padding: 0.2, duration: 500 });
  }, [fitView]);

  const handleSave = useCallback(async () => {
    try {
      // Save node positions individually
      for (const node of nodes) {
        await updateNode.mutateAsync({
          id: node.id,
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        });
      }
      toast.success("Fluxo salvo!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  }, [nodes, updateNode]);

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm shrink-0 z-10">
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
          <Button variant="outline" onClick={handleCenterView}>
            <AlignCenter className="w-4 h-4 mr-2" />
            Centralizar
          </Button>
          <Button variant="outline" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
          <Button className="bg-primary">Publicar</Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-slate-900"
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          }}
        >
          <Controls className="!bg-white !border !shadow-lg" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#475569" />
          
          {/* Add Node Panel */}
          <Panel position="top-left" className="!mt-4 !ml-4">
            <DropdownMenu open={showAddMenu} onOpenChange={setShowAddMenu}>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Bloco
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 bg-white border shadow-lg z-50">
                <DropdownMenuItem onClick={() => handleAddNode("messenger")} className="flex items-center gap-2 p-3 cursor-pointer">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  Mensagem
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode("ai_step")} className="flex items-center gap-2 p-3 cursor-pointer">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Resposta IA
                  <Badge variant="secondary" className="ml-auto text-xs">AI</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode("delay")} className="flex items-center gap-2 p-3 cursor-pointer">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Aguardar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAddNode("condition")} className="flex items-center gap-2 p-3 cursor-pointer">
                  <GitBranch className="w-4 h-4 text-orange-500" />
                  Condição
                  <Badge className="ml-auto text-xs bg-amber-500">PRO</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode("randomizer")} className="flex items-center gap-2 p-3 cursor-pointer">
                  <Shuffle className="w-4 h-4 text-pink-500" />
                  Randomizador
                  <Badge className="ml-auto text-xs bg-amber-500">PRO</Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
