-- Criar tabela de convites para equipe
CREATE TABLE public.team_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
    invited_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_role CHECK (role IN ('admin', 'member')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Índices para performance
CREATE INDEX idx_team_invitations_company ON public.team_invitations(company_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);

-- Habilitar RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para team_invitations
-- Admins/Owners podem ver convites da empresa
CREATE POLICY "Admins podem ver convites da empresa"
ON public.team_invitations
FOR SELECT
USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
);

-- Admins/Owners podem criar convites
CREATE POLICY "Admins podem criar convites"
ON public.team_invitations
FOR INSERT
WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND invited_by = auth.uid()
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
);

-- Admins/Owners podem cancelar convites
CREATE POLICY "Admins podem cancelar convites"
ON public.team_invitations
FOR UPDATE
USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
);

-- Admins/Owners podem deletar convites
CREATE POLICY "Admins podem deletar convites"
ON public.team_invitations
FOR DELETE
USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
);

-- Política para permitir que convidados aceitem (via token - será usado por edge function)
-- Convidados podem ver seu próprio convite pelo email
CREATE POLICY "Usuários podem ver convites para seu email"
ON public.team_invitations
FOR SELECT
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Adicionar política para profiles permitir que admins/owners vejam todos os membros da empresa
CREATE POLICY "Admins podem ver todos os perfis da empresa"
ON public.profiles
FOR SELECT
USING (
    company_id IS NOT NULL 
    AND company_id = get_user_company_id(auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
);

-- Política para owners atualizarem roles de membros
CREATE POLICY "Owners podem atualizar roles de membros"
ON public.profiles
FOR UPDATE
USING (
    company_id = get_user_company_id(auth.uid())
    AND user_id != auth.uid()
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
    )
);

-- Política para owners removerem membros (setar company_id como null)
CREATE POLICY "Owners podem remover membros"
ON public.profiles
FOR UPDATE
USING (
    company_id = get_user_company_id(auth.uid())
    AND user_id != auth.uid()
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
    )
);