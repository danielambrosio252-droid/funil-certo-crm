-- Criar função para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Criar uma empresa para o usuário
  INSERT INTO public.companies (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || substr(NEW.id::text, 1, 8)
  )
  RETURNING id INTO new_company_id;

  -- Criar perfil do usuário como owner da empresa
  INSERT INTO public.profiles (user_id, email, full_name, company_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_company_id,
    'owner'
  );

  RETURN NEW;
END;
$$;

-- Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar empresa e perfil para o usuário existente que não tem perfil
DO $$
DECLARE
  user_record RECORD;
  new_company_id uuid;
BEGIN
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.id IS NULL
  LOOP
    -- Criar empresa
    INSERT INTO public.companies (name, slug)
    VALUES (
      COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
      LOWER(REPLACE(COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)), ' ', '-')) || '-' || substr(user_record.id::text, 1, 8)
    )
    RETURNING id INTO new_company_id;

    -- Criar perfil
    INSERT INTO public.profiles (user_id, email, full_name, company_id, role)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
      new_company_id,
      'owner'
    );
  END LOOP;
END;
$$;