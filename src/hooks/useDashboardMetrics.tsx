import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, endOfWeek, subDays, format } from "date-fns";

export interface DashboardMetrics {
  totalLeads: number;
  totalConversas: number;
  conversionRate: number;
  funnelValue: number;
  reentryLeads: number;
  
  // Métricas de Ads
  totalSpend: number;
  totalClicks: number;
  totalLinkClicks: number;
  totalImpressions: number;
  
  // Métricas calculadas
  cpc: number; // Custo por Clique
  cpm: number; // Custo por Mil Impressões
  ctr: number; // Click Through Rate
  cpl: number; // Custo por Lead
  cplConversation: number; // Custo por Conversa
  
  // Variações percentuais
  leadsChange: number;
  conversasChange: number;
  conversionChange: number;
  valueChange: number;
  reentryChange: number;
  
  // Dados para gráficos
  dailyData: DailyData[];
}

export interface DailyData {
  date: string;
  day: string;
  leads: number;
  conversas: number;
  spend: number;
  clicks: number;
  impressions: number;
}

export function useDashboardMetrics() {
  const { profile } = useAuth();
  
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
  const endOfThisWeek = endOfWeek(today, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const endOfLastWeek = subDays(startOfThisWeek, 1);
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics", profile?.company_id],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!profile?.company_id) {
        return getEmptyMetrics();
      }
      
      // Buscar leads desta semana
      const { data: leadsThisWeek } = await supabase
        .from("funnel_leads")
        .select("id, value, is_reentry, created_at")
        .eq("company_id", profile.company_id)
        .gte("created_at", startOfThisWeek.toISOString())
        .lte("created_at", endOfThisWeek.toISOString());
      
      // Buscar leads da semana passada
      const { data: leadsLastWeek } = await supabase
        .from("funnel_leads")
        .select("id, value, is_reentry, created_at")
        .eq("company_id", profile.company_id)
        .gte("created_at", startOfLastWeek.toISOString())
        .lte("created_at", endOfLastWeek.toISOString());
      
      // Buscar total de leads
      const { data: allLeads } = await supabase
        .from("funnel_leads")
        .select("id, value, is_reentry, created_at")
        .eq("company_id", profile.company_id);
      
      // Buscar conversas WhatsApp desta semana
      const { data: conversasThisWeek } = await supabase
        .from("whatsapp_messages")
        .select("id, created_at")
        .eq("company_id", profile.company_id)
        .eq("is_from_me", false)
        .gte("created_at", startOfThisWeek.toISOString())
        .lte("created_at", endOfThisWeek.toISOString());
      
      // Buscar conversas da semana passada
      const { data: conversasLastWeek } = await supabase
        .from("whatsapp_messages")
        .select("id, created_at")
        .eq("company_id", profile.company_id)
        .eq("is_from_me", false)
        .gte("created_at", startOfLastWeek.toISOString())
        .lte("created_at", endOfLastWeek.toISOString());
      
      // Buscar total de conversas (contatos únicos)
      const { data: totalContacts } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("company_id", profile.company_id);
      
      // Buscar métricas de ads desta semana
      const { data: adsThisWeek } = await supabase
        .from("ad_metrics")
        .select("*")
        .eq("company_id", profile.company_id)
        .gte("date", format(startOfThisWeek, "yyyy-MM-dd"))
        .lte("date", format(endOfThisWeek, "yyyy-MM-dd"));
      
      // Buscar métricas de ads da semana passada
      const { data: adsLastWeek } = await supabase
        .from("ad_metrics")
        .select("*")
        .eq("company_id", profile.company_id)
        .gte("date", format(startOfLastWeek, "yyyy-MM-dd"))
        .lte("date", format(endOfLastWeek, "yyyy-MM-dd"));
      
      // Buscar leads por dia da semana atual para o gráfico
      const { data: leadsByDay } = await supabase
        .from("funnel_leads")
        .select("created_at")
        .eq("company_id", profile.company_id)
        .gte("created_at", startOfThisWeek.toISOString())
        .lte("created_at", endOfThisWeek.toISOString());
      
      // Calcular métricas
      const totalLeads = allLeads?.length || 0;
      const leadsThisWeekCount = leadsThisWeek?.length || 0;
      const leadsLastWeekCount = leadsLastWeek?.length || 0;
      
      const totalConversas = totalContacts?.length || 0;
      const conversasThisWeekCount = conversasThisWeek?.length || 0;
      const conversasLastWeekCount = conversasLastWeek?.length || 0;
      
      const reentryLeadsThisWeek = leadsThisWeek?.filter(l => l.is_reentry)?.length || 0;
      const reentryLeadsLastWeek = leadsLastWeek?.filter(l => l.is_reentry)?.length || 0;
      
      const funnelValue = allLeads?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      const valueThisWeek = leadsThisWeek?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      const valueLastWeek = leadsLastWeek?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      
      // Calcular taxa de conversão
      const conversionRate = totalLeads > 0 ? (totalConversas / totalLeads) * 100 : 0;
      const conversionThisWeek = leadsThisWeekCount > 0 ? (conversasThisWeekCount / leadsThisWeekCount) * 100 : 0;
      const conversionLastWeek = leadsLastWeekCount > 0 ? (conversasLastWeekCount / leadsLastWeekCount) * 100 : 0;
      
      // Métricas de ads
      const totalSpend = adsThisWeek?.reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0) || 0;
      const totalClicks = adsThisWeek?.reduce((sum, ad) => sum + (ad.clicks || 0), 0) || 0;
      const totalLinkClicks = adsThisWeek?.reduce((sum, ad) => sum + (ad.link_clicks || 0), 0) || 0;
      const totalImpressions = adsThisWeek?.reduce((sum, ad) => sum + (ad.impressions || 0), 0) || 0;
      const adsLeads = adsThisWeek?.reduce((sum, ad) => sum + (ad.leads || 0), 0) || 0;
      const adsConversas = adsThisWeek?.reduce((sum, ad) => sum + (ad.conversas || 0), 0) || 0;
      
      // Métricas calculadas
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpl = adsLeads > 0 ? totalSpend / adsLeads : 0;
      const cplConversation = adsConversas > 0 ? totalSpend / adsConversas : 0;
      
      // Calcular variações
      const leadsChange = calculateChange(leadsThisWeekCount, leadsLastWeekCount);
      const conversasChange = calculateChange(conversasThisWeekCount, conversasLastWeekCount);
      const conversionChange = calculateChange(conversionThisWeek, conversionLastWeek);
      const valueChange = calculateChange(valueThisWeek, valueLastWeek);
      const reentryChange = calculateChange(reentryLeadsThisWeek, reentryLeadsLastWeek);
      
      // Dados diários para gráfico
      const dailyData = generateDailyData(leadsByDay || [], adsThisWeek || [], startOfThisWeek);
      
      return {
        totalLeads,
        totalConversas,
        conversionRate,
        funnelValue,
        reentryLeads: allLeads?.filter(l => l.is_reentry)?.length || 0,
        totalSpend,
        totalClicks,
        totalLinkClicks,
        totalImpressions,
        cpc,
        cpm,
        ctr,
        cpl,
        cplConversation,
        leadsChange,
        conversasChange,
        conversionChange,
        valueChange,
        reentryChange,
        dailyData,
      };
    },
    enabled: !!profile?.company_id,
    staleTime: 30000, // 30 seconds
  });
  
  return {
    metrics: metrics || getEmptyMetrics(),
    isLoading,
  };
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function generateDailyData(
  leads: { created_at: string }[],
  ads: any[],
  startOfWeek: Date
): DailyData[] {
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const dailyData: DailyData[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + i);
    const dateStr = format(date, "yyyy-MM-dd");
    
    const dayLeads = leads.filter(l => 
      format(new Date(l.created_at), "yyyy-MM-dd") === dateStr
    ).length;
    
    const dayAds = ads.filter(a => a.date === dateStr);
    const daySpend = dayAds.reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0);
    const dayClicks = dayAds.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const dayImpressions = dayAds.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const dayConversas = dayAds.reduce((sum, ad) => sum + (ad.conversas || 0), 0);
    
    dailyData.push({
      date: dateStr,
      day: dayNames[i],
      leads: dayLeads,
      conversas: dayConversas,
      spend: daySpend,
      clicks: dayClicks,
      impressions: dayImpressions,
    });
  }
  
  return dailyData;
}

function getEmptyMetrics(): DashboardMetrics {
  return {
    totalLeads: 0,
    totalConversas: 0,
    conversionRate: 0,
    funnelValue: 0,
    reentryLeads: 0,
    totalSpend: 0,
    totalClicks: 0,
    totalLinkClicks: 0,
    totalImpressions: 0,
    cpc: 0,
    cpm: 0,
    ctr: 0,
    cpl: 0,
    cplConversation: 0,
    leadsChange: 0,
    conversasChange: 0,
    conversionChange: 0,
    valueChange: 0,
    reentryChange: 0,
    dailyData: [],
  };
}