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
  ReactFlowInstance,
  BackgroundVariant,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, LayoutGrid, Plus } from "lucide-react";
import { toast } from "sonner";
import { useFlowEditor, FlowNode, FlowEdge, NodeType } from "@/hooks/useWhatsAppFlows";
import { flowNodeTypes, availableNodeTypes } from "./FlowNodeTypes";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Channel info type
interface Channel {
  id: string;
  mode: 'cloud_api' | 'baileys';
  phoneNumber: string | null;
  displayName: string;
  status?: string;
}

interface ChannelInfo {
  channels: Channel[];
  selectedChannelId: string | null;
}

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
    channelInfo?: ChannelInfo;
    onConfigure: () => void;
    onChannelChange?: (channelId: string) => void;
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

// Constants for HORIZONTAL layout (Kommo-style)
const LAYOUT = {
  START_X: 100,
  START_Y: 200,
  GAP_X: 300, // Horizontal spacing between nodes
  GAP_Y: 150, // Vertical spacing for branches
  NODE_WIDTH: 220,
};

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { profile } = useAuth();
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
  const [channelInfo, setChannelInfo] = useState<ChannelInfo>({
    channels: [],
    selectedChannelId: null
  });
  
  // Use ref to avoid re-triggering node creation when channelInfo updates
  const channelInfoRef = useRef(channelInfo);
  useEffect(() => {
    channelInfoRef.current = channelInfo;
  }, [channelInfo]);

  // Fetch ALL available channels (both API and Baileys if configured)
  useEffect(() => {
    const fetchAllChannels = async () => {
      if (!profile?.company_id) return;

      try {
        const channels: Channel[] = [];

        // Get company WhatsApp config for Cloud API
        const { data: company } = await supabase
          .from('companies')
          .select('whatsapp_mode, whatsapp_phone_number_id, whatsapp_waba_id')
          .eq('id', profile.company_id)
          .single();

        // Check if Cloud API is configured
        if (company?.whatsapp_phone_number_id) {
          channels.push({
            id: 'cloud_api',
            mode: 'cloud_api',
            phoneNumber: company.whatsapp_phone_number_id,
            displayName: `API Oficial ...${company.whatsapp_phone_number_id.slice(-4)}`,
            status: 'active'
          });
        }

        // Check if Baileys session exists
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('id, phone_number, status')
          .eq('company_id', profile.company_id)
          .single();

        if (session) {
          const phone = session.phone_number;
          const displayPhone = phone ? `...${phone.slice(-4)}` : '';
          channels.push({
            id: 'baileys',
            mode: 'baileys',
            phoneNumber: phone,
            displayName: `WhatsApp Web ${displayPhone}`,
            status: session.status
          });
        }

        // Set channels and auto-select based on current mode
        setChannelInfo({
          channels,
          selectedChannelId: company?.whatsapp_mode === 'cloud_api' ? 'cloud_api' : 
                            company?.whatsapp_mode === 'baileys' ? 'baileys' : 
                            channels.length > 0 ? channels[0].id : null
        });
      } catch (error) {
        console.error('Error fetching channels:', error);
      }
    };

    fetchAllChannels();
  }, [profile?.company_id]);

  // Track if we already auto-fixed the layout for this session
  const didAutoFixRef = useRef(false);
  useEffect(() => {
    didAutoFixRef.current = false;
  }, [flowId]);

  // Avoid viewport jitter/flicker: fit view only once after first real hydration
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const didInitialFitViewRef = useRef(false);
  useEffect(() => {
    didInitialFitViewRef.current = false;
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

  // Handle channel selection change
  const handleChannelChange = useCallback((nodeId: string, channelId: string) => {
    // Update the node config to save selected channel
    const node = dbNodes.find(n => n.id === nodeId);
    if (node) {
      updateNode.mutate({
        id: nodeId,
        config: {
          ...node.config,
          selected_channel: channelId
        }
      });
    }
    // Update local state
    setChannelInfo(prev => ({
      ...prev,
      selectedChannelId: channelId
    }));
  }, [dbNodes, updateNode]);

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
      channelInfo: channelInfoRef.current,
      onConfigure: () => {
        setSelectedNode({
          id: node.id,
          type: node.node_type,
          position: { x: node.position_x, y: node.position_y },
          data: { config: node.config },
        });
        setShowConfigDialog(true);
      },
      onChannelChange: (channelId: string) => handleChannelChange(node.id, channelId),
    },
  }), [nodeIndexMap, handleChannelChange]);

  const initialNodes = useMemo(() => 
    dbNodes.map(createNodeData) as FlowEditorNode[], 
    [dbNodes, createNodeData]
  );

  // Convert DB edges to React Flow format with Kommo-style edges
  const initialEdges = useMemo(() => 
    dbEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      label: edge.label,
      animated: false,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    })) as FlowEditorEdge[], [dbEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowEditorNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEditorEdge>(initialEdges);

  // Sync with DB data
  useEffect(() => {
    // Prevent wiping the canvas during transient empty states (e.g. auth/profile re-hydration)
    if (dbNodes.length === 0) return;
    setNodes(dbNodes.map(createNodeData) as FlowEditorNode[]);
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
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      })) as FlowEditorEdge[])
    );
  }, [dbEdges, setEdges]);

  // Auto-fix layout on load if needed
  useEffect(() => {
    if (loadingNodes || loadingEdges) return;
    if (didAutoFixRef.current) return;
    if (dbNodes.length === 0) return;

    didAutoFixRef.current = true;

    // Check if layout is messy (nodes at same position or all at Y=0/default)
    const positions = dbNodes.map(n => ({ x: n.position_x, y: n.position_y }));
    const hasOverlap = positions.some((p1, i) => 
      positions.some((p2, j) => i !== j && Math.abs(p1.x - p2.x) < 50 && Math.abs(p1.y - p2.y) < 50)
    );
    
    // NOTE: In our horizontal Kommo-style layout it's normal for nodes to share the same Y.
    // Only auto-fix when there's real overlap.
    const needsReorganization = hasOverlap;

    if (!needsReorganization) return;

    // Apply horizontal layout
    const newPositions = computeHorizontalLayout(dbNodes);
    
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

  // Fit view once when nodes are first rendered
  useEffect(() => {
    if (didInitialFitViewRef.current) return;
    if (!reactFlowInstanceRef.current) return;
    if (nodes.length === 0) return;

    reactFlowInstanceRef.current.fitView({ padding: 0.2 });
    didInitialFitViewRef.current = true;
  }, [nodes.length]);

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

  // Add new node - HORIZONTAL layout
  const handleAddNode = async (type: NodeType) => {
    const currentNodes = nodes;
    
    // Find rightmost X position
    let maxX = LAYOUT.START_X;
    currentNodes.forEach((node) => {
      if (node.position.x > maxX) {
        maxX = node.position.x;
      }
    });

    // New node goes to the right
    const nextX = maxX + LAYOUT.GAP_X;
    const nextY = LAYOUT.START_Y;

    try {
      await addNode.mutateAsync({
        node_type: type,
        position_x: nextX,
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

  // Auto-organize layout - horizontal
  const handleAutoOrganize = () => {
    if (nodes.length === 0) return;

    const newPositions = computeHorizontalLayout(
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

  if (!profile?.company_id || loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Kommo-style Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-300 hover:text-white hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-slate-600" />
          <h2 className="text-lg font-semibold text-white">{flowName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoOrganize}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
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
            Salvar e Continuar
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
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-slate-900"
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={24} 
            size={1.5} 
            color="rgba(255,255,255,0.08)"
          />
          <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg [&_button]:!bg-slate-700 [&_button]:!border-slate-600 [&_button]:hover:!bg-slate-600 [&_button_svg]:!fill-slate-300" />
          <MiniMap 
            className="!bg-slate-800 !border-slate-700 !shadow-lg"
            maskColor="rgba(0,0,0,0.7)"
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

          {/* Kommo-style floating Add Step menu */}
          <Panel position="top-right" className="!m-4">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="sm" 
                    className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar próximo passo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-64 bg-slate-800 border-slate-700 shadow-2xl"
                >
                  <div className="px-3 py-2 border-b border-slate-700">
                    <p className="text-xs font-medium text-slate-400">Adicionar próximo passo</p>
                  </div>
                  {availableNodeTypes.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <DropdownMenuItem
                        key={nodeType.type}
                        onClick={() => handleAddNode(nodeType.type as NodeType)}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer text-slate-200 hover:bg-slate-700 focus:bg-slate-700"
                      >
                        <div className={cn("p-1.5 rounded-md", nodeType.bgColor)}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-medium">{nodeType.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
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
 * Horizontal layout algorithm (Kommo-style: left to right)
 * - Start node on the left
 * - Other nodes ordered by creation date, placed horizontally
 */
function computeHorizontalLayout(
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

  // Position horizontally
  sortedNodes.forEach((node, index) => {
    newPositions.set(node.id, {
      x: LAYOUT.START_X + index * LAYOUT.GAP_X,
      y: LAYOUT.START_Y,
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
