-- ==========================================
-- CHATBOT FLOW BUILDER - DATABASE SCHEMA
-- ==========================================

-- Table: chatbot_flows (main flow definition)
CREATE TABLE public.chatbot_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  trigger_keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: chatbot_flow_nodes (individual blocks)
CREATE TABLE public.chatbot_flow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL, -- start, message, question, condition, delay, action, transfer, end
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: chatbot_flow_edges (connections between nodes)
CREATE TABLE public.chatbot_flow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.chatbot_flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.chatbot_flow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT, -- for multiple outputs (e.g., condition true/false)
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: chatbot_flow_executions (tracking active conversations)
CREATE TABLE public.chatbot_flow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  current_node_id UUID REFERENCES public.chatbot_flow_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running, waiting_response, paused, completed, failed
  context JSONB DEFAULT '{}'::jsonb, -- stores variables, user responses, etc.
  is_human_takeover BOOLEAN NOT NULL DEFAULT false,
  next_action_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table: chatbot_flow_logs (execution history)
CREATE TABLE public.chatbot_flow_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.chatbot_flow_executions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.chatbot_flow_nodes(id) ON DELETE SET NULL,
  node_type TEXT,
  action TEXT NOT NULL, -- entered, executed, decision, error
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chatbot_flows
CREATE POLICY "Users can view flows from their company"
  ON public.chatbot_flows FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create flows for their company"
  ON public.chatbot_flows FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update flows from their company"
  ON public.chatbot_flows FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete flows from their company"
  ON public.chatbot_flows FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS Policies for chatbot_flow_nodes
CREATE POLICY "Users can view nodes from their company"
  ON public.chatbot_flow_nodes FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create nodes for their company"
  ON public.chatbot_flow_nodes FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update nodes from their company"
  ON public.chatbot_flow_nodes FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete nodes from their company"
  ON public.chatbot_flow_nodes FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS Policies for chatbot_flow_edges
CREATE POLICY "Users can view edges from their company"
  ON public.chatbot_flow_edges FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create edges for their company"
  ON public.chatbot_flow_edges FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update edges from their company"
  ON public.chatbot_flow_edges FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete edges from their company"
  ON public.chatbot_flow_edges FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS Policies for chatbot_flow_executions
CREATE POLICY "Users can view executions from their company"
  ON public.chatbot_flow_executions FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create executions for their company"
  ON public.chatbot_flow_executions FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update executions from their company"
  ON public.chatbot_flow_executions FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete executions from their company"
  ON public.chatbot_flow_executions FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS Policies for chatbot_flow_logs
CREATE POLICY "Users can view logs from their company"
  ON public.chatbot_flow_logs FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create logs for their company"
  ON public.chatbot_flow_logs FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_chatbot_flows_company ON public.chatbot_flows(company_id);
CREATE INDEX idx_chatbot_flows_active ON public.chatbot_flows(company_id, is_active);
CREATE INDEX idx_chatbot_flow_nodes_flow ON public.chatbot_flow_nodes(flow_id);
CREATE INDEX idx_chatbot_flow_edges_flow ON public.chatbot_flow_edges(flow_id);
CREATE INDEX idx_chatbot_flow_executions_contact ON public.chatbot_flow_executions(contact_id, status);
CREATE INDEX idx_chatbot_flow_executions_status ON public.chatbot_flow_executions(company_id, status);
CREATE INDEX idx_chatbot_flow_logs_execution ON public.chatbot_flow_logs(execution_id);

-- Trigger for updated_at
CREATE TRIGGER update_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();