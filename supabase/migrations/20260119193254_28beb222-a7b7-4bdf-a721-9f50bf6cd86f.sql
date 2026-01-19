-- Adicionar campos CNPJ e endereço na tabela companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;