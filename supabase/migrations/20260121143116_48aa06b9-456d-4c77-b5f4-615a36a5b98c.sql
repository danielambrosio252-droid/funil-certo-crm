-- Tabela de Fluxos de Automação WhatsApp
CREATE TABLE public.whatsapp_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL, -- 'new_lead', 'keyword', 'schedule', 'stage_change'
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_config JSONB DEFAULT '{}'::jsonb, -- horários permitidos, dias da semana
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Nós (Blocos) do Fluxo
CREATE TABLE public.whatsapp_flow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.whatsapp_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  node_type TEXT NOT NULL, -- 'start', 'message', 'template', 'media', 'delay', 'wait_response', 'condition', 'end'
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- configuração específica do tipo
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Conexões entre Nós
CREATE TABLE public.whatsapp_flow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.whatsapp_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES public.whatsapp_flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.whatsapp_flow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT, -- para múltiplas saídas (ex: condições)
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Execuções de Fluxo (para rastrear leads no fluxo)
CREATE TABLE public.whatsapp_flow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.whatsapp_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  current_node_id UUID REFERENCES public.whatsapp_flow_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'waiting', 'completed', 'paused', 'failed'
  context JSONB DEFAULT '{}'::jsonb, -- dados coletados durante execução
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_action_at TIMESTAMP WITH TIME ZONE -- para delays
);

-- Enable RLS
ALTER TABLE public.whatsapp_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_flow_executions ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_flows
CREATE POLICY "Usuários veem fluxos da sua empresa" ON public.whatsapp_flows
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem criar fluxos" ON public.whatsapp_flows
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem atualizar fluxos da sua empresa" ON public.whatsapp_flows
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem deletar fluxos da sua empresa" ON public.whatsapp_flows
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Políticas para whatsapp_flow_nodes
CREATE POLICY "Usuários veem nós da sua empresa" ON public.whatsapp_flow_nodes
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem criar nós" ON public.whatsapp_flow_nodes
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem atualizar nós da sua empresa" ON public.whatsapp_flow_nodes
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem deletar nós da sua empresa" ON public.whatsapp_flow_nodes
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Políticas para whatsapp_flow_edges
CREATE POLICY "Usuários veem conexões da sua empresa" ON public.whatsapp_flow_edges
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem criar conexões" ON public.whatsapp_flow_edges
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem atualizar conexões da sua empresa" ON public.whatsapp_flow_edges
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Usuários podem deletar conexões da sua empresa" ON public.whatsapp_flow_edges
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Políticas para whatsapp_flow_executions
CREATE POLICY "Usuários veem execuções da sua empresa" ON public.whatsapp_flow_executions
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Sistema pode inserir execuções" ON public.whatsapp_flow_executions
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Sistema pode atualizar execuções" ON public.whatsapp_flow_executions
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_flows_updated_at
  BEFORE UPDATE ON public.whatsapp_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();