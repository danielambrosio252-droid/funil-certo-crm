import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { runAutomations, detectChanges } from "@/lib/automationEngine";

export interface Funnel {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelStage {
  id: string;
  funnel_id: string;
  company_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelLead {
  id: string;
  stage_id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  value: number;
  source: string | null;
  tags: string[];
  notes: string | null;
  position: number;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFunnels() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todos os funis
  const { data: funnels = [], isLoading: loadingFunnels } = useQuery({
    queryKey: ["funnels", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data as Funnel[];
    },
    enabled: !!profile?.company_id,
  });

  // Criar funil
  const createFunnel = useMutation({
    mutationFn: async (funnel: { name: string; description?: string; color?: string }) => {
      if (!profile?.company_id) throw new Error("Sem empresa");
      
      const maxPosition = funnels.length > 0 
        ? Math.max(...funnels.map(f => f.position)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("funnels")
        .insert({
          company_id: profile.company_id,
          name: funnel.name,
          description: funnel.description || null,
          color: funnel.color || "#6366f1",
          position: maxPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Funnel;
    },
    onSuccess: (newFunnel) => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast.success(`Funil "${newFunnel.name}" criado com sucesso!`);
    },
    onError: (error) => {
      toast.error("Erro ao criar funil: " + error.message);
    },
  });

  // Atualizar funil
  const updateFunnel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Funnel> & { id: string }) => {
      const { data, error } = await supabase
        .from("funnels")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Funnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast.success("Funil atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar funil: " + error.message);
    },
  });

  // Deletar funil
  const deleteFunnel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast.success("Funil excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir funil: " + error.message);
    },
  });

  return {
    funnels,
    loadingFunnels,
    createFunnel,
    updateFunnel,
    deleteFunnel,
  };
}

export function useFunnelStages(funnelId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar etapas do funil
  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["funnel-stages", funnelId],
    queryFn: async () => {
      if (!funnelId) return [];
      const { data, error } = await supabase
        .from("funnel_stages")
        .select("*")
        .eq("funnel_id", funnelId)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data as FunnelStage[];
    },
    enabled: !!funnelId,
  });

  // Criar etapa
  const createStage = useMutation({
    mutationFn: async (stage: { name: string; color?: string }) => {
      if (!profile?.company_id || !funnelId) throw new Error("Sem empresa ou funil");
      
      const maxPosition = stages.length > 0 
        ? Math.max(...stages.map(s => s.position)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("funnel_stages")
        .insert({
          funnel_id: funnelId,
          company_id: profile.company_id,
          name: stage.name,
          color: stage.color || "#6366f1",
          position: maxPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as FunnelStage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-stages", funnelId] });
      toast.success("Etapa criada!");
    },
    onError: (error) => {
      toast.error("Erro ao criar etapa: " + error.message);
    },
  });

  // Atualizar etapa
  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FunnelStage> & { id: string }) => {
      const { data, error } = await supabase
        .from("funnel_stages")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FunnelStage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-stages", funnelId] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar etapa: " + error.message);
    },
  });

  // Deletar etapa
  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnel_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-stages", funnelId] });
      toast.success("Etapa excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir etapa: " + error.message);
    },
  });

  // Reordenar etapas
  const reorderStages = useMutation({
    mutationFn: async (orderedStages: { id: string; position: number }[]) => {
      const promises = orderedStages.map(({ id, position }) =>
        supabase.from("funnel_stages").update({ position }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-stages", funnelId] });
    },
  });

  return {
    stages,
    loadingStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
}

export function useFunnelLeads(stageIds: string[], funnelId?: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar leads de múltiplas etapas
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["funnel-leads", stageIds],
    queryFn: async () => {
      if (stageIds.length === 0) return [];
      const { data, error } = await supabase
        .from("funnel_leads")
        .select("*")
        .in("stage_id", stageIds)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data as FunnelLead[];
    },
    enabled: stageIds.length > 0,
  });

  // Criar lead
  const createLead = useMutation({
    mutationFn: async (lead: {
      stage_id: string;
      name: string;
      email?: string;
      phone?: string;
      value?: number;
      source?: string;
      tags?: string[];
    }) => {
      if (!profile?.company_id) throw new Error("Sem empresa");
      
      const stageLeads = leads.filter(l => l.stage_id === lead.stage_id);
      const maxPosition = stageLeads.length > 0 
        ? Math.max(...stageLeads.map(l => l.position)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("funnel_leads")
        .insert({
          stage_id: lead.stage_id,
          company_id: profile.company_id,
          name: lead.name,
          email: lead.email || null,
          phone: lead.phone || null,
          value: lead.value || 0,
          source: lead.source || null,
          tags: lead.tags || [],
          position: maxPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as FunnelLead;
    },
    onSuccess: async (newLead) => {
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      toast.success("Lead adicionado!");
      
      // Run automations for lead_created event
      if (profile?.company_id && funnelId) {
        await runAutomations(
          { event: "lead_created", lead: newLead },
          profile.company_id,
          funnelId
        );
        // Refresh leads after automation may have moved them
        queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      }
    },
    onError: (error) => {
      toast.error("Erro ao criar lead: " + error.message);
    },
  });

  // Atualizar lead
  const updateLead = useMutation({
    mutationFn: async ({ id, previousLead, ...updates }: Partial<FunnelLead> & { id: string; previousLead?: FunnelLead }) => {
      const { data, error } = await supabase
        .from("funnel_leads")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return { updatedLead: data as FunnelLead, previousLead };
    },
    onSuccess: async ({ updatedLead, previousLead }) => {
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      
      // Run automations for lead_updated event
      if (profile?.company_id && funnelId) {
        const changes = detectChanges(updatedLead, previousLead);
        
        // Run general update automation
        await runAutomations(
          { event: "lead_updated", lead: updatedLead, previousLead },
          profile.company_id,
          funnelId
        );
        
        // Run tag_added automations for each new tag
        for (const tag of changes.tagsAdded) {
          await runAutomations(
            { event: "tag_added", lead: updatedLead, addedTag: tag },
            profile.company_id,
            funnelId
          );
        }
        
        // Run value_changed automation
        if (changes.valueChanged) {
          await runAutomations(
            { event: "value_changed", lead: updatedLead, previousLead },
            profile.company_id,
            funnelId
          );
        }
        
        // Refresh leads after automations
        queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      }
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lead: " + error.message);
    },
  });

  // Deletar lead
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnel_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      toast.success("Lead removido!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir lead: " + error.message);
    },
  });

  // Mover lead entre etapas
  const moveLead = useMutation({
    mutationFn: async ({
      leadId,
      newStageId,
      newPosition,
    }: {
      leadId: string;
      newStageId: string;
      newPosition: number;
    }) => {
      const { error } = await supabase
        .from("funnel_leads")
        .update({ stage_id: newStageId, position: newPosition })
        .eq("id", leadId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
    },
  });

  return {
    leads,
    loadingLeads,
    createLead,
    updateLead,
    deleteLead,
    moveLead,
  };
}
