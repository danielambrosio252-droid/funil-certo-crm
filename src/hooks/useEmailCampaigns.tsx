import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { EmailContent } from "@/components/email/EmailEditor";
import { Json } from "@/integrations/supabase/types";

export interface EmailCampaign {
  id: string;
  company_id: string;
  name: string;
  subject: string;
  preheader: string | null;
  template: string;
  campaign_type: string;
  content: EmailContent;
  list_id: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignData {
  name: string;
  subject: string;
  preheader?: string;
  template: string;
  campaign_type: string;
  content: EmailContent;
  list_id?: string;
  status?: string;
  scheduled_at?: string | null;
}

export function useEmailCampaigns() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ["email-campaigns", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        content: item.content as unknown as EmailContent,
      })) as EmailCampaign[];
    },
    enabled: !!companyId,
  });

  const createCampaign = useMutation({
    mutationFn: async (campaignData: CreateCampaignData) => {
      if (!companyId) throw new Error("Company ID not found");

      const { data, error } = await supabase
        .from("email_campaigns")
        .insert({
          company_id: companyId,
          name: campaignData.name,
          subject: campaignData.subject,
          preheader: campaignData.preheader || null,
          template: campaignData.template,
          campaign_type: campaignData.campaign_type,
          content: campaignData.content as unknown as Json,
          list_id: campaignData.list_id || null,
          status: campaignData.status || "draft",
          scheduled_at: campaignData.scheduled_at || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns", companyId] });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailCampaign> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.content) {
        updateData.content = updates.content as unknown as Json;
      }

      const { data, error } = await supabase
        .from("email_campaigns")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns", companyId] });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns", companyId] });
      toast.success("Campanha excluída com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir campanha");
    },
  });

  const scheduleCampaign = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAt,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns", companyId] });
      toast.success("Campanha agendada com sucesso");
    },
    onError: () => {
      toast.error("Erro ao agendar campanha");
    },
  });

  return {
    campaigns,
    isLoading,
    refetch,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    scheduleCampaign,
  };
}
