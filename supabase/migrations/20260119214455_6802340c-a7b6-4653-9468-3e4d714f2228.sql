-- Primeiro, dropar as políticas problemáticas que causam recursão infinita
DROP POLICY IF EXISTS "Admins podem ver todos os perfis da empresa" ON public.profiles;
DROP POLICY IF EXISTS "Owners podem atualizar roles de membros" ON public.profiles;
DROP POLICY IF EXISTS "Owners podem remover membros" ON public.profiles;
DROP POLICY IF EXISTS "Usuários veem perfis da mesma empresa" ON public.profiles;

-- Criar função SECURITY DEFINER para verificar se o usuário é admin ou owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner_safe(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = check_user_id
    AND role IN ('owner', 'admin')
  )
$$;

-- Criar função SECURITY DEFINER para verificar se o usuário é owner
CREATE OR REPLACE FUNCTION public.is_owner_safe(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = check_user_id
    AND role = 'owner'
  )
$$;

-- Recriar política para ver perfis da mesma empresa (sem recursão)
CREATE POLICY "Usuários veem perfis da mesma empresa"
ON public.profiles
FOR SELECT
USING (
  company_id IS NOT NULL 
  AND company_id = get_user_company_id(auth.uid())
);

-- Política para owners atualizarem roles de outros membros (usando função segura)
CREATE POLICY "Owners podem atualizar roles de membros"
ON public.profiles
FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND user_id <> auth.uid()
  AND is_owner_safe(auth.uid())
);