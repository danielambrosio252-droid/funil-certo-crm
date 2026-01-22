import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

// Verify Meta webhook signature
async function verifySignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature || !appSecret) return false;

  const expectedSignature = signature.replace("sha256=", "");
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === expectedSignature;
}

// Normalize phone number
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, "");
  
  // Add Brazil country code if missing
  if (normalized.length >= 10 && normalized.length <= 11) {
    normalized = "55" + normalized;
  }
  
  // Add 9 for Brazilian mobile numbers
  if (normalized.startsWith("55") && normalized.length === 12) {
    const ddd = normalized.substring(2, 4);
    const num = normalized.substring(4);
    normalized = "55" + ddd + "9" + num;
  }
  
  return normalized;
}

// Get media URL from Meta
async function getMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to get media info:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error("Error getting media URL:", error);
    return null;
  }
}

// Download media from Meta and upload to our storage
async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  messageType: string,
  companyId: string
): Promise<string | null> {
  try {
    // First, get the media URL from Meta
    const mediaUrl = await getMediaUrl(mediaId, accessToken);
    if (!mediaUrl) {
      console.error("Could not get media URL for:", mediaId);
      return null;
    }

    // Download the media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      console.error("Failed to download media:", mediaResponse.status);
      return null;
    }

    // Get content type
    const contentType = mediaResponse.headers.get("content-type") || "application/octet-stream";
    
    // Determine file extension
    let extension = "bin";
    if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) extension = "jpg";
    else if (contentType.includes("image/png")) extension = "png";
    else if (contentType.includes("image/webp")) extension = "webp";
    else if (contentType.includes("image/gif")) extension = "gif";
    else if (contentType.includes("audio/ogg")) extension = "ogg";
    else if (contentType.includes("audio/mpeg")) extension = "mp3";
    else if (contentType.includes("audio/mp4")) extension = "m4a";
    else if (contentType.includes("audio/amr")) extension = "amr";
    else if (contentType.includes("audio/aac")) extension = "aac";
    else if (contentType.includes("video/mp4")) extension = "mp4";
    else if (contentType.includes("video/3gpp")) extension = "3gp";
    else if (contentType.includes("application/pdf")) extension = "pdf";
    else if (contentType.includes("application/msword")) extension = "doc";
    else if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml")) extension = "docx";
    else if (contentType.includes("application/vnd.ms-excel")) extension = "xls";
    else if (contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml")) extension = "xlsx";

    const blob = await mediaResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${companyId}/${messageType}s/${timestamp}-${randomId}.${extension}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, uint8Array, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload media to storage:", error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(data.path);

    console.log("Media stored successfully:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error downloading and storing media:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appSecret = Deno.env.get("WHATSAPP_CLOUD_APP_SECRET");
  const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN");
  const verifyToken = Deno.env.get("WHATSAPP_CLOUD_VERIFY_TOKEN") || "lovable_whatsapp_verify";

  // Handle webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Verification failed", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  
  // Verify signature if app secret is configured
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256") || "";
    const isValid = await verifySignature(body, signature, appSecret);
    
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = JSON.parse(body);
    console.log("Webhook payload:", JSON.stringify(payload, null, 2));

    // Meta webhook structure
    const entry = payload.entry?.[0];
    if (!entry) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const changes = entry.changes?.[0];
    if (!changes || changes.field !== "messages") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const value = changes.value;
    const phoneNumberId = value.metadata?.phone_number_id;

    if (!phoneNumberId) {
      console.error("No phone_number_id in webhook");
      return new Response(JSON.stringify({ error: "Missing phone_number_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find company by phone_number_id
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("whatsapp_phone_number_id", phoneNumberId)
      .single();

    if (!company) {
      console.error("Company not found for phone_number_id:", phoneNumberId);
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = company.id;

    // Process incoming messages
    const messages = value.messages || [];
    for (const message of messages) {
      const senderPhone = message.from;
      const normalizedPhone = normalizePhone(senderPhone);
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

      // Get or create contact
      let { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("normalized_phone", normalizedPhone)
        .maybeSingle();

      if (!contact) {
        // Get contact name from webhook if available
        const contactInfo = value.contacts?.[0];
        const contactName = contactInfo?.profile?.name || senderPhone;

        const { data: newContact } = await supabase
          .from("whatsapp_contacts")
          .insert({
            company_id: companyId,
            phone: senderPhone,
            normalized_phone: normalizedPhone,
            name: contactName,
            last_message_at: timestamp,
          })
          .select("id")
          .single();

        contact = newContact;
      } else {
        // Update last_message_at and increment unread
        await supabase.rpc("increment_unread_count", { contact_uuid: contact.id });
        await supabase
          .from("whatsapp_contacts")
          .update({ last_message_at: timestamp })
          .eq("id", contact.id);
      }

      if (!contact) {
        console.error("Failed to get/create contact");
        continue;
      }

      // Extract message content and process media
      // NOTE: whatsapp_messages has a CHECK constraint that only allows:
      // text | image | audio | video | document | sticker
      let content = "";
      let messageType = "text";
      let mediaUrl: string | null = null;
      let buttonId: string | null = null; // For interactive button responses

      if (message.type === "text") {
        content = message.text?.body || "";
      } else if (message.type === "interactive") {
        // Interactive button response
        if (message.interactive?.type === "button_reply") {
          buttonId = message.interactive.button_reply?.id || null;
          content = message.interactive.button_reply?.title || "";
          // Persist as text due to DB constraint
          messageType = "text";
          console.log(`📱 Button reply received: id="${buttonId}", title="${content}"`);
        } else if (message.interactive?.type === "list_reply") {
          buttonId = message.interactive.list_reply?.id || null;
          content = message.interactive.list_reply?.title || "";
          // Persist as text due to DB constraint
          messageType = "text";
        }
      } else if (message.type === "button") {
        // Legacy button response
        buttonId = message.button?.payload || null;
        content = message.button?.text || "";
        // Persist as text due to DB constraint
        messageType = "text";
      } else if (message.type === "image") {
        content = message.image?.caption || "[Imagem]";
        messageType = "image";
        
        // Download and store the image
        if (accessToken && message.image?.id) {
          mediaUrl = await downloadAndStoreMedia(
            message.image.id,
            accessToken,
            supabase,
            "image",
            companyId
          );
        }
      } else if (message.type === "audio") {
        content = "[Áudio]";
        messageType = "audio";
        
        // Download and store the audio
        if (accessToken && message.audio?.id) {
          mediaUrl = await downloadAndStoreMedia(
            message.audio.id,
            accessToken,
            supabase,
            "audio",
            companyId
          );
        }
      } else if (message.type === "video") {
        content = message.video?.caption || "[Vídeo]";
        messageType = "video";
        
        // Download and store the video
        if (accessToken && message.video?.id) {
          mediaUrl = await downloadAndStoreMedia(
            message.video.id,
            accessToken,
            supabase,
            "video",
            companyId
          );
        }
      } else if (message.type === "document") {
        content = message.document?.filename || "[Documento]";
        messageType = "document";
        
        // Download and store the document
        if (accessToken && message.document?.id) {
          mediaUrl = await downloadAndStoreMedia(
            message.document.id,
            accessToken,
            supabase,
            "document",
            companyId
          );
        }
      } else if (message.type === "sticker") {
        content = "[Sticker]";
        messageType = "sticker";
        
        // Download and store the sticker
        if (accessToken && message.sticker?.id) {
          mediaUrl = await downloadAndStoreMedia(
            message.sticker.id,
            accessToken,
            supabase,
            "sticker",
            companyId
          );
        }
      } else if (message.type === "location") {
        content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
        // Persist as text due to DB constraint
        messageType = "text";
      } else if (message.type === "contacts") {
        content = "[Contato compartilhado]";
        // Persist as text due to DB constraint
        messageType = "text";
      } else {
        content = `[${message.type}]`;
        // Persist as text due to DB constraint
        messageType = "text";
      }

      // Check for duplicate message
      const { data: existingMessage } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existingMessage) {
        console.log("Duplicate message, skipping:", messageId);
        continue;
      }

      // Save message
      const { error: insertError } = await supabase.from("whatsapp_messages").insert({
        company_id: companyId,
        contact_id: contact.id,
        message_id: messageId,
        content,
        message_type: messageType,
        media_url: mediaUrl,
        is_from_me: false,
        // IMPORTANT: must match whatsapp_messages_status_check constraint
        // Allowed: pending | sent | delivered | read | failed
        status: "delivered",
        sent_at: timestamp,
      });

      if (insertError) {
        console.error("Error saving message:", insertError);
      } else {
        console.log("Message saved:", messageId, "| Type:", messageType, "| Media:", mediaUrl ? "Yes" : "No");
        
        // ===== TRIGGER: DISPARAR FLUXOS DE AUTOMAÇÃO (KEYWORD) =====
        if (messageType === "text" && content) {
          try {
            const flowExecutorUrl = `${supabaseUrl}/functions/v1/flow-executor`;
            
            await fetch(flowExecutorUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                trigger_type: "keyword",
                company_id: companyId,
                contact_id: contact.id,
                message_content: content,
              }),
            });
            
            console.log(`[Webhook] 🚀 Trigger keyword disparado`);
          } catch (flowError) {
            console.error("[Webhook] Erro ao disparar fluxo:", flowError);
          }
        }
        
        // ===== VERIFICAR SE HÁ FLUXO AGUARDANDO RESPOSTA =====
        try {
          const { data: waitingExecution } = await supabase
            .from("chatbot_flow_executions")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_id", contact.id)
            .eq("status", "waiting_response")
            .maybeSingle();
          
          if (waitingExecution) {
            // Retomar execução - passar button_id se for resposta de botão
            const flowExecutorUrl = `${supabaseUrl}/functions/v1/flow-executor`;
            
            await fetch(flowExecutorUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                trigger_type: "continue_execution",
                company_id: companyId,
                execution_id: waitingExecution.id,
                button_id: buttonId, // Pass button_id for interactive responses
                user_response: content, // Pass the content as well
              }),
            });
            
            console.log(`[Webhook] 🔄 Execução retomada: ${waitingExecution.id}, buttonId: ${buttonId}`);
          }
        } catch (execError) {
          console.error("[Webhook] Erro ao retomar execução:", execError);
        }
      }
    }

    // Process status updates
    const statuses = value.statuses || [];
    for (const status of statuses) {
      const messageId = status.id;
      const newStatus = status.status; // sent, delivered, read, failed

      // Map Meta status to our status
      let mappedStatus = newStatus;
      if (newStatus === "delivered") mappedStatus = "delivered";
      else if (newStatus === "read") mappedStatus = "read";
      else if (newStatus === "failed") mappedStatus = "failed";

      await supabase
        .from("whatsapp_messages")
        .update({ status: mappedStatus })
        .eq("message_id", messageId);

      console.log("Status updated:", messageId, "->", mappedStatus);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
