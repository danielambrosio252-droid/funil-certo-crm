import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Types
export type NodeType = "start" | "message" | "question" | "condition" | "delay" | "pause" | "action" | "transfer" | "end";

export interface ChatbotFlow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  trigger_keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatbotFlowNode {
  id: string;
  flow_id: string;
  company_id: string;
  node_type: NodeType;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface ChatbotFlowEdge {
  id: string;
  flow_id: string;
  company_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
  created_at: string;
}

export interface ChatbotFlowExecution {
  id: string;
  flow_id: string;
  company_id: string;
  contact_id: string | null;
  lead_id: string | null;
  current_node_id: string | null;
  status: "running" | "waiting_response" | "paused" | "completed" | "failed";
  context: Record<string, unknown>;
  is_human_takeover: boolean;
  next_action_at: string | null;
  started_at: string;
  completed_at: string | null;
}

// Helper to make raw SQL-like queries via RPC or direct fetch
// Note: Tables are new and types aren't regenerated yet, using 'any' casting
const getFlowsTable = () => (supabase as any).from("chatbot_flows");
const getNodesTable = () => (supabase as any).from("chatbot_flow_nodes");
const getEdgesTable = () => (supabase as any).from("chatbot_flow_edges");
const getExecutionsTable = () => (supabase as any).from("chatbot_flow_executions");

// Hook for managing flows
export function useChatbotFlows() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: flows = [], isLoading: loadingFlows } = useQuery({
    queryKey: ["chatbot-flows", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await getFlowsTable()
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChatbotFlow[];
    },
    enabled: !!profile?.company_id,
  });

  const createFlow = useMutation({
    mutationFn: async (input: { name: string; description?: string; trigger_keywords?: string[]; is_default?: boolean }) => {
      if (!profile?.company_id) throw new Error("No company");
      
      // Create flow
      const { data: flow, error: flowError } = await getFlowsTable()
        .insert({
          company_id: profile.company_id,
          name: input.name,
          description: input.description || null,
          trigger_keywords: input.trigger_keywords || [],
          is_default: input.is_default || false,
          // Default flow must be active so the editor never loads without an active flow.
          is_active: input.is_default ? true : false,
        })
        .select()
        .single();
      
      if (flowError) throw flowError;

      // Create initial start node - centered on canvas
      const { error: nodeError } = await getNodesTable()
        .insert({
          flow_id: flow.id,
          company_id: profile.company_id,
          node_type: "start",
          position_x: 400,
          position_y: 200,
          config: { label: "Quando o contato iniciar conversa" },
        });

      if (nodeError) throw nodeError;

      return flow as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Fluxo criado!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao criar fluxo");
    },
  });

  const updateFlow = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; is_active?: boolean; trigger_keywords?: string[] }) => {
      const { id, ...updates } = input;
      const { error } = await getFlowsTable()
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
    },
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getFlowsTable()
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Fluxo excluído!");
    },
  });

  const toggleFlow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await getFlowsTable()
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success(variables.is_active ? "Fluxo ativado!" : "Fluxo pausado!");
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

// Hook for editing a specific flow
export function useChatbotFlowEditor(flowId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch nodes
  const { data: nodes = [], isLoading: loadingNodes } = useQuery({
    queryKey: ["chatbot-flow-nodes", flowId],
    queryFn: async () => {
      if (!flowId) return [];
      const { data, error } = await getNodesTable()
        .select("*")
        .eq("flow_id", flowId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatbotFlowNode[];
    },
    enabled: !!flowId,
  });

  // Fetch edges
  const { data: edges = [], isLoading: loadingEdges } = useQuery({
    queryKey: ["chatbot-flow-edges", flowId],
    queryFn: async () => {
      if (!flowId) return [];
      const { data, error } = await getEdgesTable()
        .select("*")
        .eq("flow_id", flowId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatbotFlowEdge[];
    },
    enabled: !!flowId,
  });

  // Add node
  const addNode = useMutation({
    mutationFn: async (input: { node_type: NodeType; position_x: number; position_y: number; config?: Record<string, unknown> }) => {
      if (!flowId || !profile?.company_id) throw new Error("Missing flow or company");
      const { data, error } = await getNodesTable()
        .insert({
          flow_id: flowId,
          company_id: profile.company_id,
          node_type: input.node_type,
          position_x: input.position_x,
          position_y: input.position_y,
          config: input.config || {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlowNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-nodes", flowId] });
    },
  });

  // Update node
  const updateNode = useMutation({
    mutationFn: async (input: { id: string; position_x?: number; position_y?: number; config?: Record<string, unknown> }) => {
      const { id, ...updates } = input;
      const { error } = await getNodesTable()
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-nodes", flowId] });
    },
  });

  // Delete node
  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      // First delete connected edges
      await getEdgesTable()
        .delete()
        .or(`source_node_id.eq.${id},target_node_id.eq.${id}`);
      
      // Then delete node
      const { error } = await getNodesTable()
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-nodes", flowId] });
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-edges", flowId] });
    },
  });

  // Add edge
  const addEdge = useMutation({
    mutationFn: async (input: { source_node_id: string; target_node_id: string; source_handle?: string; label?: string }) => {
      if (!flowId || !profile?.company_id) throw new Error("Missing flow or company");
      const { data, error } = await getEdgesTable()
        .insert({
          flow_id: flowId,
          company_id: profile.company_id,
          source_node_id: input.source_node_id,
          target_node_id: input.target_node_id,
          source_handle: input.source_handle || null,
          label: input.label || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlowEdge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-edges", flowId] });
    },
  });

  // Delete edge
  const deleteEdge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getEdgesTable()
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow-edges", flowId] });
    },
  });

  // CRITICAL FAILSAFE: Ensure Start node exists
  const ensureStartNode = useCallback(async () => {
    if (!flowId || !profile?.company_id) return;
    
    // Query directly from DB to avoid stale state
    const { data: existingNodes, error: fetchError } = await getNodesTable()
      .select("id, node_type")
      .eq("flow_id", flowId)
      .eq("node_type", "start")
      .limit(1);
    
    if (fetchError) {
      console.error("Error checking for start node:", fetchError);
      throw fetchError;
    }
    
    // If start node exists, do nothing
    if (existingNodes && existingNodes.length > 0) {
      console.log("[ensureStartNode] Start node already exists");
      return;
    }
    
    // Create start node centered on canvas
    console.log("[ensureStartNode] Creating start node...");
    const { error } = await getNodesTable()
      .insert({
        flow_id: flowId,
        company_id: profile.company_id,
        node_type: "start",
        position_x: 400,
        position_y: 200,
        config: { label: "Quando o contato iniciar conversa" },
      });
    
    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ["chatbot-flow-nodes", flowId] });
    toast.success("Nó inicial criado!");
  }, [flowId, profile?.company_id, queryClient]);

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
    ensureStartNode,
  };
}

// Hook to check if bot is active for a contact
export function useChatbotStatus(contactId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: execution, isLoading } = useQuery({
    queryKey: ["chatbot-execution", contactId],
    queryFn: async () => {
      if (!contactId || !profile?.company_id) return null;
      const { data, error } = await getExecutionsTable()
        .select("*")
        .eq("contact_id", contactId)
        .in("status", ["running", "waiting_response", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ChatbotFlowExecution | null;
    },
    enabled: !!contactId && !!profile?.company_id,
    refetchInterval: 5000, // Poll every 5s
  });

  const toggleHumanTakeover = useMutation({
    mutationFn: async (isHuman: boolean) => {
      if (!execution) throw new Error("No active execution");
      const { error } = await getExecutionsTable()
        .update({
          is_human_takeover: isHuman,
          status: isHuman ? "paused" : "running",
        })
        .eq("id", execution.id);
      if (error) throw error;
    },
    onSuccess: (_, isHuman) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-execution", contactId] });
      toast.success(isHuman ? "Atendimento humano ativado" : "Bot reativado");
    },
  });

  const stopExecution = useMutation({
    mutationFn: async () => {
      if (!execution) throw new Error("No active execution");
      const { error } = await getExecutionsTable()
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-execution", contactId] });
      toast.success("Fluxo encerrado");
    },
  });

  return {
    execution,
    isLoading,
    isBotActive: !!execution && !execution.is_human_takeover && execution.status !== "paused",
    isHumanTakeover: execution?.is_human_takeover || false,
    toggleHumanTakeover,
    stopExecution,
  };
}
