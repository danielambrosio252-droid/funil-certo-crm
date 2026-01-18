-- Corrigir search_path da função normalize_whatsapp_phone
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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