-- =====================================================
-- TABELAS PARA GESTÃO DE FUNIS
-- =====================================================

-- Tabela de Funis
CREATE TABLE public.funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Etapas do Funil
CREATE TABLE public.funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Leads (cards do funil)
CREATE TABLE public.funnel_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  value DECIMAL(12,2) DEFAULT 0,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  position INTEGER DEFAULT 0,
  last_contact_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_funnels_company_id ON public.funnels(company_id);
CREATE INDEX idx_funnel_stages_funnel_id ON public.funnel_stages(funnel_id);
CREATE INDEX idx_funnel_stages_company_id ON public.funnel_stages(company_id);
CREATE INDEX idx_funnel_leads_stage_id ON public.funnel_leads(stage_id);
CREATE INDEX idx_funnel_leads_company_id ON public.funnel_leads(company_id);

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - FUNNELS
-- =====================================================
CREATE POLICY "Usuários veem funis da sua empresa"
ON public.funnels FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem criar funis"
ON public.funnels FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar funis da sua empresa"
ON public.funnels FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem deletar funis da sua empresa"
ON public.funnels FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - FUNNEL_STAGES
-- =====================================================
CREATE POLICY "Usuários veem etapas da sua empresa"
ON public.funnel_stages FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem criar etapas"
ON public.funnel_stages FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar etapas da sua empresa"
ON public.funnel_stages FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem deletar etapas da sua empresa"
ON public.funnel_stages FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - FUNNEL_LEADS
-- =====================================================
CREATE POLICY "Usuários veem leads da sua empresa"
ON public.funnel_leads FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem criar leads"
ON public.funnel_leads FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar leads da sua empresa"
ON public.funnel_leads FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem deletar leads da sua empresa"
ON public.funnel_leads FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================
CREATE TRIGGER update_funnels_updated_at
BEFORE UPDATE ON public.funnels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_stages_updated_at
BEFORE UPDATE ON public.funnel_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_leads_updated_at
BEFORE UPDATE ON public.funnel_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();