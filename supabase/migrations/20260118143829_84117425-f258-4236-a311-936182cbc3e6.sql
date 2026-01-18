-- Função para incrementar contador de mensagens não lidas
CREATE OR REPLACE FUNCTION public.increment_unread_count(contact_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.whatsapp_contacts
  SET unread_count = unread_count + 1
  WHERE id = contact_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Política para permitir insert em companies (para signup)
CREATE POLICY "Usuários podem criar empresas no signup" 
ON public.companies 
FOR INSERT 
WITH CHECK (true);

-- Política para permitir update em companies pelos admins
CREATE POLICY "Admins podem atualizar sua empresa" 
ON public.companies 
FOR UPDATE 
USING (
  id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);