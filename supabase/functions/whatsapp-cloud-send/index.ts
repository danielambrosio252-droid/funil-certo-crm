import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessagePayload {
  contact_id?: string;
  phone?: string;
  content?: string;
  action?: "send" | "test" | "check_token";
  message_type?: "text" | "image" | "audio" | "document" | "video";
  media_url?: string;
  media_filename?: string;
  media_caption?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cloudAccessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Authenticate user
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid user token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get user's company
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.company_id) {
    return new Response(
      JSON.stringify({ error: "User has no company" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const companyId = profile.company_id;

  // Get company's cloud API config
  const { data: company } = await supabase
    .from("companies")
    .select("whatsapp_mode, whatsapp_phone_number_id, whatsapp_waba_id")
    .eq("id", companyId)
    .single();

  const payload: SendMessagePayload = await req.json();
  const messageType = payload.message_type || "text";

  // Check token action
  if (payload.action === "check_token") {
    return new Response(
      JSON.stringify({ has_token: !!cloudAccessToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Test connection action
  if (payload.action === "test") {
    if (!cloudAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Access token not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company?.whatsapp_phone_number_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone Number ID not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const testUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}`;
      const testResponse = await fetch(testUrl, {
        headers: { Authorization: `Bearer ${cloudAccessToken}` },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        return new Response(
          JSON.stringify({ success: false, error: errorData.error?.message || "Invalid credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phoneData = await testResponse.json();
      return new Response(
        JSON.stringify({ 
          success: true, 
          phone_number: phoneData.display_phone_number,
          verified_name: phoneData.verified_name 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to connect to Meta API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Send message action
  if (!cloudAccessToken) {
    return new Response(
      JSON.stringify({ error: "Cloud API access token not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!company?.whatsapp_phone_number_id) {
    return new Response(
      JSON.stringify({ error: "Phone Number ID not configured for this company" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let recipientPhone: string | undefined;
  let contactId: string | undefined;

  if (payload.contact_id) {
    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("phone, normalized_phone")
      .eq("id", payload.contact_id)
      .eq("company_id", companyId)
      .single();

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    recipientPhone = contact.normalized_phone || contact.phone;
    contactId = payload.contact_id;
  } else if (payload.phone) {
    recipientPhone = payload.phone.replace(/\D/g, "");
  }

  // Validate required fields based on message type
  if (!recipientPhone) {
    return new Response(
      JSON.stringify({ error: "Missing phone number" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (messageType === "text" && !payload.content) {
    return new Response(
      JSON.stringify({ error: "Missing content for text message" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (messageType !== "text" && !payload.media_url) {
    return new Response(
      JSON.stringify({ error: "Missing media_url for media message" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create pending message in DB
  const messageContent = messageType === "text" 
    ? payload.content 
    : payload.media_caption || `[${messageType.toUpperCase()}]`;

  const messageInsert: Record<string, unknown> = {
    company_id: companyId,
    content: messageContent,
    is_from_me: true,
    status: "pending",
    message_type: messageType,
    media_url: payload.media_url || null,
    sent_at: new Date().toISOString(),
  };

  if (contactId) {
    messageInsert.contact_id = contactId;
  } else {
    const { data: existingContact } = await supabase
      .from("whatsapp_contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("normalized_phone", recipientPhone)
      .maybeSingle();

    if (existingContact) {
      messageInsert.contact_id = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from("whatsapp_contacts")
        .insert({
          company_id: companyId,
          phone: recipientPhone,
          normalized_phone: recipientPhone,
        })
        .select("id")
        .single();

      if (newContact) {
        messageInsert.contact_id = newContact.id;
      }
    }
  }

  const { data: messageData, error: messageError } = await supabase
    .from("whatsapp_messages")
    .insert(messageInsert)
    .select("id")
    .single();

  if (messageError) {
    console.error("Error creating message:", messageError);
    return new Response(
      JSON.stringify({ error: "Failed to create message record" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Send via Meta Cloud API
  try {
    const sendUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`;
    
    let metaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: messageType,
    };

    if (messageType === "text") {
      metaPayload.text = { body: payload.content };
    } else if (messageType === "audio" && payload.media_url) {
      // AUDIO: Requires upload to Meta's /media endpoint first, then send with media_id
      console.log("[AUDIO] Iniciando processamento de áudio...");
      console.log("[AUDIO] URL do arquivo:", payload.media_url);
      
      // Step 1: Download audio from Supabase Storage
      console.log("[AUDIO] Baixando arquivo do storage...");
      const audioResponse = await fetch(payload.media_url);
      
      if (!audioResponse.ok) {
        console.error("[AUDIO] Falha ao baixar arquivo:", audioResponse.status);
        throw new Error("Failed to download audio file from storage");
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      console.log("[AUDIO] Arquivo baixado, tamanho:", audioBuffer.byteLength, "bytes");
      
      // Step 2: Upload to Meta's /media endpoint
      console.log("[AUDIO] Fazendo upload para Meta /media...");
      const mediaUploadUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/media`;
      
      // Create FormData for multipart upload
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });
      formData.append("file", audioBlob, "audio.ogg");
      formData.append("type", "audio/ogg");
      formData.append("messaging_product", "whatsapp");
      
      const uploadResponse = await fetch(mediaUploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudAccessToken}`,
        },
        body: formData,
      });
      
      const uploadResult = await uploadResponse.json();
      console.log("[AUDIO] Resposta do upload:", JSON.stringify(uploadResult), "Status:", uploadResponse.status);
      
      if (!uploadResponse.ok || !uploadResult.id) {
        console.error("[AUDIO] Falha no upload para Meta:", uploadResult);
        
        await supabase
          .from("whatsapp_messages")
          .update({ status: "failed" })
          .eq("id", messageData.id);
        
        return new Response(
          JSON.stringify({ 
            error: uploadResult.error?.message || "Failed to upload audio to WhatsApp",
            details: uploadResult,
            message_id: messageData.id 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const mediaId = uploadResult.id;
      console.log("[AUDIO] Upload concluído com sucesso, media_id:", mediaId);
      
      // Step 3: Build message payload with media_id (not link!)
      metaPayload.audio = { id: mediaId };
      console.log("[AUDIO] Payload preparado para envio com media_id");
      
    } else {
      // For other media messages (image, video, document), use the public URL directly
      // Meta accepts public HTTPS URLs for these types
      const mediaContent: Record<string, unknown> = {
        link: payload.media_url,
      };

      if (payload.media_caption && (messageType === "image" || messageType === "video" || messageType === "document")) {
        mediaContent.caption = payload.media_caption;
      }

      if (messageType === "document" && payload.media_filename) {
        mediaContent.filename = payload.media_filename;
      }

      metaPayload[messageType] = mediaContent;
    }

    console.log("Sending to Meta:", JSON.stringify(metaPayload, null, 2));

    const metaResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const metaResult = await metaResponse.json();
    console.log("Meta API Response:", JSON.stringify(metaResult, null, 2), "Status:", metaResponse.status);

    if (!metaResponse.ok) {
      console.error("Meta API error:", metaResult);
      
      await supabase
        .from("whatsapp_messages")
        .update({ status: "failed" })
        .eq("id", messageData.id);

      return new Response(
        JSON.stringify({ 
          error: metaResult.error?.message || "Failed to send message",
          message_id: messageData.id 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaMessageId = metaResult.messages?.[0]?.id;
    
    if (messageType === "audio") {
      console.log("[AUDIO] Mensagem enviada com sucesso! meta_message_id:", metaMessageId);
    }
    
    await supabase
      .from("whatsapp_messages")
      .update({ 
        status: "sent",
        message_id: metaMessageId 
      })
      .eq("id", messageData.id);

    if (messageInsert.contact_id) {
      await supabase
        .from("whatsapp_contacts")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", messageInsert.contact_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageData.id,
        meta_message_id: metaMessageId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error sending to Meta API:", err);
    
    if (messageType === "audio") {
      console.error("[AUDIO] Erro crítico no processamento de áudio:", err);
    }

    await supabase
      .from("whatsapp_messages")
      .update({ status: "failed" })
      .eq("id", messageData.id);

    return new Response(
      JSON.stringify({ error: "Failed to send message to Meta API" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
