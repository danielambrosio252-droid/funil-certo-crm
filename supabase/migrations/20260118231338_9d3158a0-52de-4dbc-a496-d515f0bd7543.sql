-- =====================================================
-- MIGRAÇÃO: NORMALIZAÇÃO E UNIFICAÇÃO DE CONTATOS WHATSAPP
-- =====================================================
-- 
-- Esta migração:
-- 1. Cria função de normalização de telefone no banco
-- 2. Identifica e unifica contatos duplicados
-- 3. Move mensagens para o contato correto
-- 4. Remove contatos duplicados

-- 1. Criar função de normalização de telefone
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  phone TEXT;
  ddi TEXT;
  ddd TEXT;
  num TEXT;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN '';
  END IF;

  -- Remover sufixos do WhatsApp
  phone := input;
  phone := regexp_replace(phone, '@s\.whatsapp\.net$', '', 'i');
  phone := regexp_replace(phone, '@c\.us$', '', 'i');
  phone := regexp_replace(phone, '@lid$', '', 'i');
  phone := regexp_replace(phone, '@g\.us$', '', 'i');
  phone := regexp_replace(phone, '@broadcast$', '', 'i');
  
  -- Remover device ID (ex: "5583999999999:45" -> "5583999999999")
  phone := split_part(phone, ':', 1);
  
  -- Remover caracteres não numéricos
  phone := regexp_replace(phone, '\D', '', 'g');
  
  -- Se número muito longo (>15), provavelmente é LID - retornar vazio
  IF length(phone) > 15 THEN
    RETURN '';
  END IF;
  
  -- Garantir DDI do Brasil se número curto
  IF length(phone) >= 10 AND length(phone) <= 11 THEN
    phone := '55' || phone;
  END IF;
  
  -- Corrigir números brasileiros (adicionar 9 se necessário)
  IF phone LIKE '55%' AND length(phone) = 12 THEN
    ddi := substring(phone FROM 1 FOR 2);
    ddd := substring(phone FROM 3 FOR 2);
    num := substring(phone FROM 5);
    phone := ddi || ddd || '9' || num;
  END IF;
  
  RETURN phone;
END;
$$;

-- 2. Adicionar coluna normalized_phone aos contatos (para índice e busca rápida)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_contacts' 
    AND column_name = 'normalized_phone'
  ) THEN
    ALTER TABLE public.whatsapp_contacts 
    ADD COLUMN normalized_phone TEXT;
  END IF;
END $$;

-- 3. Preencher normalized_phone para todos os contatos existentes
UPDATE public.whatsapp_contacts 
SET normalized_phone = public.normalize_whatsapp_phone(phone)
WHERE normalized_phone IS NULL OR normalized_phone = '';

-- 4. Identificar e unificar contatos duplicados
-- Para cada grupo de duplicados, manter o mais antigo e mover mensagens
DO $$
DECLARE
  dup RECORD;
  keep_id UUID;
  merge_ids UUID[];
BEGIN
  -- Para cada empresa/telefone normalizado com duplicados
  FOR dup IN 
    SELECT 
      company_id, 
      normalized_phone,
      array_agg(id ORDER BY created_at ASC) as contact_ids,
      count(*) as cnt
    FROM public.whatsapp_contacts
    WHERE normalized_phone IS NOT NULL 
      AND normalized_phone != ''
    GROUP BY company_id, normalized_phone
    HAVING count(*) > 1
  LOOP
    -- Manter o primeiro (mais antigo)
    keep_id := dup.contact_ids[1];
    -- Pegar os outros para merge
    merge_ids := dup.contact_ids[2:array_length(dup.contact_ids, 1)];
    
    RAISE NOTICE 'Unificando % contatos para telefone % (mantendo %)', 
      array_length(dup.contact_ids, 1), dup.normalized_phone, keep_id;
    
    -- Mover todas as mensagens dos duplicados para o principal
    UPDATE public.whatsapp_messages
    SET contact_id = keep_id
    WHERE contact_id = ANY(merge_ids);
    
    -- Atualizar unread_count somando todos
    UPDATE public.whatsapp_contacts
    SET unread_count = (
      SELECT COALESCE(SUM(unread_count), 0)
      FROM public.whatsapp_contacts
      WHERE id = ANY(dup.contact_ids)
    )
    WHERE id = keep_id;
    
    -- Atualizar last_message_at com o mais recente
    UPDATE public.whatsapp_contacts
    SET last_message_at = (
      SELECT MAX(last_message_at)
      FROM public.whatsapp_contacts
      WHERE id = ANY(dup.contact_ids)
    )
    WHERE id = keep_id;
    
    -- Atualizar nome se o principal não tiver
    UPDATE public.whatsapp_contacts c1
    SET name = (
      SELECT name FROM public.whatsapp_contacts
      WHERE id = ANY(dup.contact_ids) AND name IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE c1.id = keep_id AND c1.name IS NULL;
    
    -- Deletar os contatos duplicados
    DELETE FROM public.whatsapp_contacts
    WHERE id = ANY(merge_ids);
  END LOOP;
END $$;

-- 5. Agora que não há duplicados, atualizar o phone para o normalizado
UPDATE public.whatsapp_contacts 
SET phone = normalized_phone
WHERE normalized_phone IS NOT NULL 
  AND normalized_phone != ''
  AND phone != normalized_phone;

-- 6. Criar índice único para evitar duplicados futuros
DROP INDEX IF EXISTS idx_whatsapp_contacts_company_normalized_phone;
CREATE UNIQUE INDEX idx_whatsapp_contacts_company_normalized_phone 
ON public.whatsapp_contacts(company_id, normalized_phone)
WHERE normalized_phone IS NOT NULL AND normalized_phone != '';

-- 7. Criar índice para busca rápida
DROP INDEX IF EXISTS idx_whatsapp_contacts_normalized_phone;
CREATE INDEX idx_whatsapp_contacts_normalized_phone 
ON public.whatsapp_contacts(normalized_phone)
WHERE normalized_phone IS NOT NULL AND normalized_phone != '';