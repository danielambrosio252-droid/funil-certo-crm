-- Add custom_fields column to funnel_leads for flexible form data
ALTER TABLE public.funnel_leads 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance on custom fields
CREATE INDEX IF NOT EXISTS idx_funnel_leads_custom_fields ON public.funnel_leads USING GIN (custom_fields);