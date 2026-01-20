-- Tabela para métricas de ads (Meta Ads, Google Ads, etc.)
CREATE TABLE public.ad_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  platform TEXT NOT NULL DEFAULT 'meta', -- meta, google, tiktok, etc.
  campaign_name TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversas INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, date, platform, campaign_name)
);

-- Enable RLS
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários veem métricas da sua empresa"
ON public.ad_metrics FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem inserir métricas"
ON public.ad_metrics FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar métricas"
ON public.ad_metrics FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem deletar métricas"
ON public.ad_metrics FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Add is_reentry column to funnel_leads for tracking returning leads
ALTER TABLE public.funnel_leads 
ADD COLUMN IF NOT EXISTS is_reentry BOOLEAN DEFAULT false;

-- Create index for better performance on reentry queries
CREATE INDEX IF NOT EXISTS idx_funnel_leads_email ON public.funnel_leads(email);
CREATE INDEX IF NOT EXISTS idx_funnel_leads_phone ON public.funnel_leads(phone);