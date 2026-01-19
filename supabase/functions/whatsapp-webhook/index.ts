import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/**
 * =====================================================
 * NORMALIZADOR DE TELEFONE - REGRA DE OURO
 * =====================================================
 * 
 * Converte QUALQUER formato de JID do WhatsApp para 
 * formato E.164 puro (apenas dígitos).
 */
function normalizePhone(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let phone = input.trim();

  // 1. Remover sufixos do WhatsApp
  phone = phone
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@broadcast$/i, '');

  // 2. Remover parte do device ID (ex: "5583999999999:45" -> "5583999999999")
  phone = phone.split(':')[0];

  // 3. Remover todos os caracteres não numéricos
  phone = phone.replace(/\D/g, '');

  // 4. Se o número é muito longo (>15 dígitos), provavelmente é um LID
  if (phone.length > 15) {
    console.log(`[PhoneNormalizer] Número muito longo (possível LID): ${phone}`);
    return '';
  }

  // 5. Garantir DDI do Brasil se número curto
  if (phone.length >= 10 && phone.length <= 11) {
    phone = '55' + phone;
  }

  // 6. Corrigir números brasileiros (adicionar 9 se necessário)
  if (phone.startsWith('55') && phone.length === 12) {
    const ddi = phone.substring(0, 2);
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    phone = `${ddi}${ddd}9${number}`;
  }

  return phone;
}

/**
 * Verifica se é um LID (Link ID) do WhatsApp
 */
function isLid(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return input.includes('@lid');
}

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
    const expectedSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");
    
    // Validar secret do webhook (se configurado)
    if (expectedSecret) {
      const receivedSecret = req.headers.get("X-Webhook-Secret");
      if (receivedSecret !== expectedSecret) {
        console.warn("[Webhook] Invalid or missing secret");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const payload: WebhookPayload = await req.json();
    console.log("[Webhook] Recebido:", payload.type, "empresa:", payload.company_id);

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
        const rawPhone = data.from as string;
        const content = data.content as string;
        const messageType = (data.message_type as string) || "text";
        const messageId = data.message_id as string;
        const senderName = data.sender_name as string;
        const mediaUrl = data.media_url as string | undefined;
        const rawJid = data.raw_jid as string | undefined;

        // ✅ NORMALIZAÇÃO DE TELEFONE - REGRA DE OURO
        // O servidor já envia normalizado, mas normalizamos novamente por segurança
        const phone = normalizePhone(rawPhone);
        
        // Se não conseguiu normalizar (LID sem número), ignorar
        if (!phone) {
          console.warn(`[Webhook] Ignorando mensagem de número não normalizável: ${rawPhone} (raw_jid: ${rawJid})`);
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "unnormalizable_phone" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[Webhook] Telefone normalizado: ${rawPhone} -> ${phone}`);

        // ✅ BUSCAR CONTATO PELO TELEFONE NORMALIZADO
        // Isso garante que @lid e @s.whatsapp.net do mesmo número vão para o mesmo contato
        let { data: contact, error: contactError } = await supabase
          .from("whatsapp_contacts")
          .select("id, phone, name")
          .eq("company_id", company_id)
          .eq("phone", phone)
          .single();

        if (contactError && contactError.code === "PGRST116") {
          // Contato não existe, criar novo com telefone normalizado
          console.log(`[Webhook] Criando novo contato para telefone: ${phone}`);
          
          const { data: newContact, error: insertError } = await supabase
            .from("whatsapp_contacts")
            .insert({
              company_id,
              phone: phone, // ✅ Sempre telefone normalizado E.164
              name: senderName || null,
            })
            .select("id, phone, name")
            .single();

          if (insertError) {
            console.error("Erro ao criar contato:", insertError);
            throw insertError;
          }
          contact = newContact;
          console.log(`[Webhook] Novo contato criado: ${contact.id}`);
        } else if (contactError) {
          console.error("Erro ao buscar contato:", contactError);
          throw contactError;
        } else {
          console.log(`[Webhook] Contato existente encontrado: ${contact!.id} (${contact!.phone})`);
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

        // Atualizar contato com última mensagem e nome (se tiver)
        const updateData: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
        };
        
        // Atualizar nome apenas se tiver e o contato não tiver nome
        if (senderName && !contact!.name) {
          updateData.name = senderName;
        }
        
        await supabase
          .from("whatsapp_contacts")
          .update(updateData)
          .eq("id", contact!.id);

        // Incrementar unread_count
        await supabase.rpc("increment_unread_count", { contact_uuid: contact!.id });

        console.log("Mensagem recebida salva:", messageId, "para contato:", contact!.id);
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
        const rawPhone = data.phone as string;
        const presence = data.presence as string;
        
        // ✅ NORMALIZAÇÃO DE TELEFONE
        const phone = normalizePhone(rawPhone);
        
        if (!phone) {
          console.warn(`[Webhook] Ignorando presença de número não normalizável: ${rawPhone}`);
          break;
        }
        
        // Buscar contato pelo telefone NORMALIZADO
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
              presence,
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
