import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export type TriggerType = 
  | "lead_created" 
  | "lead_updated" 
  | "time_in_stage" 
  | "value_changed" 
  | "tag_added";

export type ActionType = 
  | "move_to_stage" 
  | "add_tag" 
  | "remove_tag" 
  | "send_notification";

export interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value: string;
}

export interface FunnelAutomation {
  id: string;
  company_id: string;
  funnel_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  action_type: ActionType;
  action_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  lead_id: string;
  company_id: string;
  triggered_at: string;
  success: boolean;
  details: Record<string, unknown>;
}

// Helper function to convert DB row to FunnelAutomation
function mapDbToAutomation(row: {
  id: string;
  company_id: string;
  funnel_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Json;
  conditions: Json;
  action_type: string;
  action_config: Json;
  created_at: string;
  updated_at: string;
}): FunnelAutomation {
  return {
    ...row,
    trigger_type: row.trigger_type as TriggerType,
    trigger_config: (row.trigger_config || {}) as Record<string, unknown>,
    conditions: (Array.isArray(row.conditions) ? row.conditions : []) as unknown as AutomationCondition[],
    action_type: row.action_type as ActionType,
    action_config: (row.action_config || {}) as Record<string, unknown>,
  };
}

export function useFunnelAutomations(funnelId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading: loadingAutomations } = useQuery({
    queryKey: ["funnel-automations", funnelId],
    queryFn: async () => {
      if (!funnelId || !profile?.company_id) return [];
      const { data, error } = await supabase
        .from("funnel_automations")
        .select("*")
        .eq("funnel_id", funnelId)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapDbToAutomation);
    },
    enabled: !!funnelId && !!profile?.company_id,
  });

  const createAutomation = useMutation({
    mutationFn: async (automation: {
      name: string;
      description?: string;
      trigger_type: TriggerType;
      trigger_config?: Record<string, unknown>;
      conditions?: AutomationCondition[];
      action_type: ActionType;
      action_config: Record<string, unknown>;
    }) => {
      if (!profile?.company_id || !funnelId) throw new Error("Sem empresa ou funil");

      const { data, error } = await supabase
        .from("funnel_automations")
        .insert({
          company_id: profile.company_id,
          funnel_id: funnelId,
          name: automation.name,
          description: automation.description || null,
          trigger_type: automation.trigger_type,
          trigger_config: (automation.trigger_config || {}) as Json,
          conditions: (automation.conditions || []) as unknown as Json,
          action_type: automation.action_type,
          action_config: automation.action_config as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToAutomation(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-automations", funnelId] });
      toast.success("Automação criada!");
    },
    onError: (error) => {
      toast.error("Erro ao criar automação: " + error.message);
    },
  });

  const updateAutomation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FunnelAutomation> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;
      if (updates.trigger_type !== undefined) dbUpdates.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) dbUpdates.trigger_config = updates.trigger_config as Json;
      if (updates.conditions !== undefined) dbUpdates.conditions = updates.conditions as unknown as Json;
      if (updates.action_type !== undefined) dbUpdates.action_type = updates.action_type;
      if (updates.action_config !== undefined) dbUpdates.action_config = updates.action_config as Json;

      const { data, error } = await supabase
        .from("funnel_automations")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToAutomation(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-automations", funnelId] });
      toast.success("Automação atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar automação: " + error.message);
    },
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnel_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-automations", funnelId] });
      toast.success("Automação excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir automação: " + error.message);
    },
  });

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("funnel_automations")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["funnel-automations", funnelId] });
      toast.success(variables.is_active ? "Automação ativada!" : "Automação desativada!");
    },
  });

  return {
    automations,
    loadingAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
  };
}
