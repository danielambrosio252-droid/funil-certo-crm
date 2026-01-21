-- Add 'processing' status to whatsapp_messages constraint
ALTER TABLE whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'processing'::text, 
  'sent'::text, 
  'delivered'::text, 
  'read'::text, 
  'failed'::text
]));