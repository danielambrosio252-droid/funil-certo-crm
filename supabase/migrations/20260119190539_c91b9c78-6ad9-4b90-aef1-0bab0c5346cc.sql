-- Tabela de automações de funil
CREATE TABLE public.funnel_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL, -- 'lead_created', 'lead_updated', 'time_in_stage', 'value_changed', 'tag_added'
  trigger_config JSONB NOT NULL DEFAULT '{}', -- Configurações específicas do trigger
  conditions JSONB NOT NULL DEFAULT '[]', -- Array de condições
  action_type TEXT NOT NULL, -- 'move_to_stage', 'add_tag', 'remove_tag', 'send_notification'
  action_config JSONB NOT NULL DEFAULT '{}', -- Configurações da ação
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funnel_automations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuários veem automações da sua empresa" 
ON public.funnel_automations 
FOR SELECT 
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem criar automações" 
ON public.funnel_automations 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar automações da sua empresa" 
ON public.funnel_automations 
FOR UPDATE 
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Usuários podem deletar automações da sua empresa" 
ON public.funnel_automations 
FOR DELETE 
USING (company_id = get_user_company_id(auth.uid()));

-- Tabela de histórico de execuções de automação
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.funnel_automations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.funnel_leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  details JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policy for logs
CREATE POLICY "Usuários veem logs da sua empresa" 
ON public.automation_logs 
FOR SELECT 
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Sistema pode inserir logs" 
ON public.automation_logs 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id(auth.uid()));