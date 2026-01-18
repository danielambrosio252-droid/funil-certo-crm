-- Criar função auxiliar para obter company_id do usuário sem causar recursão
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = user_uuid LIMIT 1
$$;

-- Criar função para verificar se usuário é admin/owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND role IN ('owner', 'admin')
  )
$$;

-- Remover políticas antigas da tabela profiles
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários veem perfis da mesma empresa" ON public.profiles;

-- Criar novas políticas sem recursão
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem inserir seu próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid());

-- Política para ver outros perfis da mesma empresa (usando função)
CREATE POLICY "Usuários veem perfis da mesma empresa"
ON public.profiles
FOR SELECT
USING (
  company_id IS NOT NULL 
  AND company_id = public.get_user_company_id(auth.uid())
);