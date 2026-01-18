import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  type: "qr_code" | "connected" | "disconnected" | "message_received" | "message_sent" | "message_status" | "presence_update";
  company_id: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const payload: WebhookPayload = await req.json();
    console.log("Webhook recebido:", payload.type, "para empresa:", payload.company_id);

    const { type, company_id, data } = payload;

    switch (type) {
      case "qr_code": {
        // Atualizar QR Code na sessão
        const { error } = await supabase
          .from("whatsapp_sessions")
          .update({
            status: "qr_code",
            qr_code: data.qr_code as string,
          })
          .eq("company_id", company_id);

        if (error) {
          console.error("Erro ao atualizar QR Code:", error);
          throw error;
        }
        console.log("QR Code atualizado com sucesso");
        break;
      }

      case "connected": {
        // Sessão conectada
        const { error } = await supabase
          .from("whatsapp_sessions")
          .update({
            status: "connected",
            phone_number: data.phone_number as string,
            qr_code: null,
            last_connected_at: new Date().toISOString(),
          })
          .eq("company_id", company_id);

        if (error) {
          console.error("Erro ao conectar sessão:", error);
          throw error;
        }
        console.log("Sessão conectada:", data.phone_number);
        break;
      }

      case "disconnected": {
        // Sessão desconectada
        const { error } = await supabase
          .from("whatsapp_sessions")
          .update({
            status: "disconnected",
            qr_code: null,
          })
          .eq("company_id", company_id);

        if (error) {
          console.error("Erro ao desconectar sessão:", error);
          throw error;
        }
        console.log("Sessão desconectada");
        break;
      }

      case "message_received": {
        // Mensagem recebida do WhatsApp
        const phone = data.from as string;
        const content = data.content as string;
        const messageType = (data.message_type as string) || "text";
        const messageId = data.message_id as string;
        const senderName = data.sender_name as string;
        const mediaUrl = data.media_url as string | undefined;

        // Buscar ou criar contato
        let { data: contact, error: contactError } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("company_id", company_id)
          .eq("phone", phone)
          .single();

        if (contactError && contactError.code === "PGRST116") {
          // Contato não existe, criar novo
          const { data: newContact, error: insertError } = await supabase
            .from("whatsapp_contacts")
            .insert({
              company_id,
              phone,
              name: senderName || phone,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("Erro ao criar contato:", insertError);
            throw insertError;
          }
          contact = newContact;
        }

        // Inserir mensagem
        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            company_id,
            contact_id: contact!.id,
            message_id: messageId,
            content,
            message_type: messageType,
            media_url: mediaUrl,
            is_from_me: false,
            status: "delivered",
          });

        if (msgError) {
          console.error("Erro ao inserir mensagem:", msgError);
          throw msgError;
        }

        // Atualizar contato com última mensagem
        await supabase
          .from("whatsapp_contacts")
          .update({
            last_message_at: new Date().toISOString(),
            name: senderName || undefined,
          })
          .eq("id", contact!.id);

        // Incrementar unread_count
        await supabase.rpc("increment_unread_count", { contact_uuid: contact!.id });

        console.log("Mensagem recebida salva:", messageId);
        break;
      }

      case "message_sent": {
        // Confirmação de mensagem enviada
        const messageId = data.message_id as string;
        const localId = data.local_id as string;

        const { error } = await supabase
          .from("whatsapp_messages")
          .update({
            message_id: messageId,
            status: "sent",
          })
          .eq("id", localId);

        if (error) {
          console.error("Erro ao atualizar mensagem enviada:", error);
        }
        console.log("Mensagem marcada como enviada:", messageId);
        break;
      }

      case "message_status": {
        // Atualização de status da mensagem (delivered, read)
        const messageId = data.message_id as string;
        const status = data.status as string;

        const { error } = await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("message_id", messageId);

        if (error) {
          console.error("Erro ao atualizar status:", error);
        }
        console.log("Status da mensagem atualizado:", messageId, status);
        break;
      }

      case "presence_update": {
        // Digitando/gravando - broadcast via realtime
        const phone = data.phone as string;
        const presence = data.presence as string; // 'composing' | 'recording'
        
        // Buscar contato pelo telefone
        const { data: contact } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("company_id", company_id)
          .eq("phone", phone)
          .single();
        
        if (contact) {
          // Broadcast via Realtime (efêmero, não persiste)
          const channel = supabase.channel(`typing:${company_id}`);
          await channel.send({
            type: "broadcast",
            event: "typing",
            payload: {
              contact_id: contact.id,
              phone,
              presence, // 'composing' ou 'recording'
              timestamp: new Date().toISOString(),
            },
          });
          console.log("Presença broadcast:", phone, presence);
        }
        break;
      }

      default:
        console.log("Tipo de webhook não reconhecido:", type);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
