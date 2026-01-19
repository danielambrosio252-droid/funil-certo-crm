-- Limpar dados do módulo WhatsApp (conforme solicitado pelo usuário)

-- 1. Limpar mensagens
DELETE FROM public.whatsapp_messages;

-- 2. Limpar contatos
DELETE FROM public.whatsapp_contacts;

-- 3. Limpar sessões
DELETE FROM public.whatsapp_sessions;