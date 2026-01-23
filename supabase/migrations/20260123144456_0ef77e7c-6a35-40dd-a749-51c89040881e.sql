-- Adicionar coluna de tags ao whatsapp_contacts para controle de atendimento humano
ALTER TABLE public.whatsapp_contacts
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Criar índice para busca rápida por tags
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_tags ON public.whatsapp_contacts USING GIN (tags);