-- Create email_lists table for organizing contacts
CREATE TABLE public.email_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_contacts table
CREATE TABLE public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  list_id UUID REFERENCES public.email_lists(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  tags TEXT[],
  source TEXT DEFAULT 'manual',
  lead_id UUID REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  is_subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Enable RLS
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_lists
CREATE POLICY "Users can view their company email lists"
ON public.email_lists FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create email lists for their company"
ON public.email_lists FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company email lists"
ON public.email_lists FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company email lists"
ON public.email_lists FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for email_contacts
CREATE POLICY "Users can view their company email contacts"
ON public.email_contacts FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create email contacts for their company"
ON public.email_contacts FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company email contacts"
ON public.email_contacts FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company email contacts"
ON public.email_contacts FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Create indexes
CREATE INDEX idx_email_contacts_company ON public.email_contacts(company_id);
CREATE INDEX idx_email_contacts_list ON public.email_contacts(list_id);
CREATE INDEX idx_email_contacts_email ON public.email_contacts(email);
CREATE INDEX idx_email_lists_company ON public.email_lists(company_id);

-- Trigger for updated_at
CREATE TRIGGER update_email_lists_updated_at
BEFORE UPDATE ON public.email_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_contacts_updated_at
BEFORE UPDATE ON public.email_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();