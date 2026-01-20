-- Adicionar campos para Cloud API na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_mode TEXT DEFAULT 'baileys';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT;

-- Comentários para documentação
COMMENT ON COLUMN companies.whatsapp_mode IS 'Modo de conexão WhatsApp: baileys (VPS) ou cloud_api (Meta oficial)';
COMMENT ON COLUMN companies.whatsapp_phone_number_id IS 'Phone Number ID da API oficial da Meta';
COMMENT ON COLUMN companies.whatsapp_waba_id IS 'WhatsApp Business Account ID da Meta';