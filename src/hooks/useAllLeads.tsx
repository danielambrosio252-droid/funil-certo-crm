import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { FunnelLead, FunnelStage } from "./useFunnels";

export interface LeadWithStage extends FunnelLead {
  stage?: FunnelStage;
}

export function useAllLeads() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all leads for the company
  const { data: leads = [], isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ["all-leads", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("funnel_leads")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as FunnelLead[];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch all stages for the company
  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["all-stages", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("funnel_stages")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data as FunnelStage[];
    },
    enabled: !!profile?.company_id,
  });

  // Get stage by ID
  const getStageById = (stageId: string) => {
    return stages.find(s => s.id === stageId);
  };

  // Create lead
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
          position: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as FunnelLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      toast.success("Lead adicionado!");
    },
    onError: (error) => {
      toast.error("Erro ao criar lead: " + error.message);
    },
  });

  // Import multiple leads
  const importLeads = useMutation({
    mutationFn: async (leadsToImport: {
      stage_id: string;
      name: string;
      email?: string;
      phone?: string;
      value?: number;
      source?: string;
      tags?: string[];
    }[]) => {
      if (!profile?.company_id) throw new Error("Sem empresa");
      
      const insertData = leadsToImport.map(lead => ({
        stage_id: lead.stage_id,
        company_id: profile.company_id,
        name: lead.name,
        email: lead.email || null,
        phone: lead.phone || null,
        value: lead.value || 0,
        source: lead.source || null,
        tags: lead.tags || [],
        position: 0,
      }));

      const { data, error } = await supabase
        .from("funnel_leads")
        .insert(insertData)
        .select();
      
      if (error) throw error;
      return data as FunnelLead[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      toast.success(`${data.length} leads importados!`);
    },
    onError: (error) => {
      toast.error("Erro ao importar leads: " + error.message);
    },
  });

  // Delete lead
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnel_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
      toast.success("Lead removido!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir lead: " + error.message);
    },
  });

  // Update lead
  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FunnelLead> & { id: string }) => {
      const { data, error } = await supabase
        .from("funnel_leads")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FunnelLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-leads"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lead: " + error.message);
    },
  });

  return {
    leads,
    stages,
    loadingLeads,
    loadingStages,
    getStageById,
    createLead,
    importLeads,
    deleteLead,
    updateLead,
    refetchLeads,
  };
}
