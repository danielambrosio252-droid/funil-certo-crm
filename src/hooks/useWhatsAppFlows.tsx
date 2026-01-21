import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export type TriggerType = "new_lead" | "keyword" | "schedule" | "stage_change";
export type NodeType = "start" | "message" | "template" | "media" | "delay" | "wait_response" | "condition" | "end";

export interface FlowTriggerConfig {
  funnel_id?: string;
  stage_id?: string;
  keywords?: string[];
}

export interface FlowScheduleConfig {
  days?: number[]; // 0-6 (domingo-sábado)
  start_time?: string; // HH:mm
  end_time?: string; // HH:mm
  timezone?: string;
}

export interface WhatsAppFlow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: FlowTriggerConfig;
  schedule_config: FlowScheduleConfig;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  company_id: string;
  node_type: NodeType;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  company_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
  created_at: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  company_id: string;
  contact_id: string | null;
  lead_id: string | null;
  current_node_id: string | null;
  status: "running" | "waiting" | "completed" | "paused" | "failed";
  context: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  next_action_at: string | null;
}

// Helper to map DB row to typed object
function mapDbToFlow(row: any): WhatsAppFlow {
  return {
    ...row,
    trigger_type: row.trigger_type as TriggerType,
    trigger_config: (row.trigger_config || {}) as FlowTriggerConfig,
    schedule_config: (row.schedule_config || {}) as FlowScheduleConfig,
  };
}

function mapDbToNode(row: any): FlowNode {
  return {
    ...row,
    node_type: row.node_type as NodeType,
    config: (row.config || {}) as Record<string, unknown>,
  };
}

function mapDbToEdge(row: any): FlowEdge {
  return row as FlowEdge;
}

export function useWhatsAppFlows() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all flows
  const { data: flows = [], isLoading: loadingFlows } = useQuery({
    queryKey: ["whatsapp-flows"],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("whatsapp_flows")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapDbToFlow);
    },
    enabled: !!profile?.company_id,
  });

  // Create flow
  const createFlow = useMutation({
    mutationFn: async (flow: {
      name: string;
      description?: string;
      trigger_type: TriggerType;
      trigger_config?: FlowTriggerConfig;
      schedule_config?: FlowScheduleConfig;
    }) => {
      if (!profile?.company_id) throw new Error("Sem empresa");

      const { data, error } = await supabase
        .from("whatsapp_flows")
        .insert({
          company_id: profile.company_id,
          name: flow.name,
          description: flow.description || null,
          trigger_type: flow.trigger_type,
          trigger_config: (flow.trigger_config || {}) as Json,
          schedule_config: (flow.schedule_config || {}) as Json,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create initial start node
      await supabase
        .from("whatsapp_flow_nodes")
        .insert({
          flow_id: data.id,
          company_id: profile.company_id,
          node_type: "start",
          position_x: 250,
          position_y: 50,
          config: {} as Json,
        });

      return mapDbToFlow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success("Fluxo criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar fluxo: " + error.message);
    },
  });

  // Update flow
  const updateFlow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppFlow> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;
      if (updates.trigger_type !== undefined) dbUpdates.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) dbUpdates.trigger_config = updates.trigger_config as Json;
      if (updates.schedule_config !== undefined) dbUpdates.schedule_config = updates.schedule_config as Json;

      const { data, error } = await supabase
        .from("whatsapp_flows")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToFlow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success("Fluxo atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar fluxo: " + error.message);
    },
  });

  // Delete flow
  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success("Fluxo excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir fluxo: " + error.message);
    },
  });

  // Toggle flow active status
  const toggleFlow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_flows")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success(variables.is_active ? "Fluxo ativado!" : "Fluxo desativado!");
    },
  });

  return {
    flows,
    loadingFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    toggleFlow,
  };
}

// Hook for managing nodes and edges of a specific flow
export function useFlowEditor(flowId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch nodes
  const { data: nodes = [], isLoading: loadingNodes } = useQuery({
    queryKey: ["flow-nodes", flowId],
    queryFn: async () => {
      if (!flowId || !profile?.company_id) return [];
      const { data, error } = await supabase
        .from("whatsapp_flow_nodes")
        .select("*")
        .eq("flow_id", flowId)
        .eq("company_id", profile.company_id);
      
      if (error) throw error;
      return (data || []).map(mapDbToNode);
    },
    enabled: !!flowId && !!profile?.company_id,
  });

  // Fetch edges
  const { data: edges = [], isLoading: loadingEdges } = useQuery({
    queryKey: ["flow-edges", flowId],
    queryFn: async () => {
      if (!flowId || !profile?.company_id) return [];
      const { data, error } = await supabase
        .from("whatsapp_flow_edges")
        .select("*")
        .eq("flow_id", flowId)
        .eq("company_id", profile.company_id);
      
      if (error) throw error;
      return (data || []).map(mapDbToEdge);
    },
    enabled: !!flowId && !!profile?.company_id,
  });

  // Add node
  const addNode = useMutation({
    mutationFn: async (node: {
      node_type: NodeType;
      position_x: number;
      position_y: number;
      config?: Record<string, unknown>;
    }) => {
      if (!profile?.company_id || !flowId) throw new Error("Sem empresa ou fluxo");

      const { data, error } = await supabase
        .from("whatsapp_flow_nodes")
        .insert({
          flow_id: flowId,
          company_id: profile.company_id,
          node_type: node.node_type,
          position_x: node.position_x,
          position_y: node.position_y,
          config: (node.config || {}) as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToNode(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-nodes", flowId] });
    },
  });

  // Update node
  const updateNode = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FlowNode> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.position_x !== undefined) dbUpdates.position_x = updates.position_x;
      if (updates.position_y !== undefined) dbUpdates.position_y = updates.position_y;
      if (updates.config !== undefined) dbUpdates.config = updates.config as Json;

      const { data, error } = await supabase
        .from("whatsapp_flow_nodes")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToNode(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-nodes", flowId] });
    },
  });

  // Delete node
  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_flow_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-nodes", flowId] });
      queryClient.invalidateQueries({ queryKey: ["flow-edges", flowId] });
    },
  });

  // Add edge
  const addEdge = useMutation({
    mutationFn: async (edge: {
      source_node_id: string;
      target_node_id: string;
      source_handle?: string;
      label?: string;
    }) => {
      if (!profile?.company_id || !flowId) throw new Error("Sem empresa ou fluxo");

      const { data, error } = await supabase
        .from("whatsapp_flow_edges")
        .insert({
          flow_id: flowId,
          company_id: profile.company_id,
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          source_handle: edge.source_handle || null,
          label: edge.label || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToEdge(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-edges", flowId] });
    },
  });

  // Delete edge
  const deleteEdge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_flow_edges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-edges", flowId] });
    },
  });

  // Save all nodes and edges (batch update for positions)
  const saveFlow = useMutation({
    mutationFn: async (data: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
      if (!profile?.company_id || !flowId) throw new Error("Sem empresa ou fluxo");

      // Update node positions
      for (const node of data.nodes) {
        await supabase
          .from("whatsapp_flow_nodes")
          .update({
            position_x: node.position_x,
            position_y: node.position_y,
            config: node.config as Json,
          })
          .eq("id", node.id);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-nodes", flowId] });
      queryClient.invalidateQueries({ queryKey: ["flow-edges", flowId] });
      toast.success("Fluxo salvo!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar fluxo: " + error.message);
    },
  });

  return {
    nodes,
    edges,
    loadingNodes,
    loadingEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    saveFlow,
  };
}
