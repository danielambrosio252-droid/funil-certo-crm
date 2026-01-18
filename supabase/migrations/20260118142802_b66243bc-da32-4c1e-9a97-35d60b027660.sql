-- ==============================================
-- FASE 1: ESCALA CERTO PRO - MÓDULO WHATSAPP WEB
-- ==============================================

-- 1. Tabela de Empresas (Multi-tenant)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de Perfis de Usuários
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela de Sessões WhatsApp (uma sessão por empresa)
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'qr_code', 'connected')),
  qr_code TEXT,
  session_data JSONB,
  webhook_url TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- 4. Tabela de Contatos WhatsApp
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  profile_picture TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, phone)
);

-- 5. Tabela de Mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  message_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker')),
  media_url TEXT,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_messages_contact ON public.whatsapp_messages(contact_id);
CREATE INDEX idx_whatsapp_messages_company ON public.whatsapp_messages(company_id);
CREATE INDEX idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);
CREATE INDEX idx_whatsapp_contacts_company ON public.whatsapp_contacts(company_id);
CREATE INDEX idx_whatsapp_contacts_last_message ON public.whatsapp_contacts(last_message_at DESC);

-- Enable RLS em todas as tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Companies
CREATE POLICY "Usuários veem apenas sua empresa" 
ON public.companies 
FOR SELECT 
USING (
  id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para Profiles
CREATE POLICY "Usuários veem perfis da mesma empresa" 
ON public.profiles 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem inserir seu próprio perfil" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Políticas RLS para WhatsApp Sessions
CREATE POLICY "Usuários veem sessões da sua empresa" 
ON public.whatsapp_sessions 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins podem gerenciar sessões" 
ON public.whatsapp_sessions 
FOR ALL 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Políticas RLS para WhatsApp Contacts
CREATE POLICY "Usuários veem contatos da sua empresa" 
ON public.whatsapp_contacts 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem gerenciar contatos da sua empresa" 
ON public.whatsapp_contacts 
FOR ALL 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para WhatsApp Messages
CREATE POLICY "Usuários veem mensagens da sua empresa" 
ON public.whatsapp_messages 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem inserir mensagens da sua empresa" 
ON public.whatsapp_messages 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;