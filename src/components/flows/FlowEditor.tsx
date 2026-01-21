import { useCallback, useMemo, useState, useEffect } from "react";
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
import { Save, ArrowLeft, Plus } from "lucide-react";
import { useFlowEditor, FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { flowNodeTypes, availableNodeTypes } from "./FlowNodeTypes";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { cn } from "@/lib/utils";

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
    addNode,
    updateNode,
    deleteNode,
    addEdge: addDbEdge,
    deleteEdge,
    saveFlow,
  } = useFlowEditor(flowId);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Convert DB nodes to React Flow format
  const initialNodes = useMemo(() => 
    dbNodes.map((node) => ({
      id: node.id,
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: { 
        label: getNodeLabel(node.node_type),
        config: node.config,
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
    })), [dbNodes]);

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
    })), [dbEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync with DB data
  useEffect(() => {
    if (dbNodes.length > 0) {
      setNodes(dbNodes.map((node) => ({
        id: node.id,
        type: node.node_type,
        position: { x: node.position_x, y: node.position_y },
        data: { 
          label: getNodeLabel(node.node_type),
          config: node.config,
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
      })));
    }
  }, [dbNodes, setNodes]);

  useEffect(() => {
    if (dbEdges.length > 0) {
      setEdges(dbEdges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle,
        label: edge.label,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      })));
    }
  }, [dbEdges, setEdges]);

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
    const centerX = 250;
    const lastNode = nodes.length > 0 
      ? nodes.reduce((prev, curr) => prev.position.y > curr.position.y ? prev : curr)
      : null;
    const positionY = lastNode ? lastNode.position.y + 120 : 50;

    try {
      await addNode.mutateAsync({
        node_type: type,
        position_x: centerX,
        position_y: positionY,
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
        <Button onClick={handleSave} disabled={saveFlow.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Fluxo
        </Button>
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
