import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Edge runtime helper (lets background tasks continue after the response)
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

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
  audio_duration?: number;
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
    status: messageType === "audio" ? "processing" : "pending",
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

  // For AUDIO: Return 202 immediately, process in background
  if (messageType === "audio" && payload.media_url) {
    console.log("[AUDIO] Received audio request -> returning 202 immediately");
    console.log("[AUDIO] message_id:", messageData.id);
    console.log("[AUDIO] media_url:", payload.media_url);
    console.log("[AUDIO] media_filename:", payload.media_filename);
    console.log("[AUDIO] audio_duration:", payload.audio_duration);
    
    // Start async processing without awaiting (MUST use waitUntil so it actually runs)
    const task = processAudioAsync(
      supabase,
      company.whatsapp_phone_number_id,
      cloudAccessToken,
      recipientPhone,
      payload.media_url,
      messageData.id,
      messageInsert.contact_id as string | undefined,
      payload.audio_duration,
      payload.media_filename
    );

    try {
      EdgeRuntime.waitUntil(task);
      console.log("[AUDIO] Background task scheduled via EdgeRuntime.waitUntil");
    } catch {
      // Fallback (not ideal): run without waiting
      task.catch(() => {});
      console.warn("[AUDIO] EdgeRuntime.waitUntil not available; task may be interrupted");
    }
    
    // Return 202 Accepted immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageData.id,
        status: "processing",
        message: "Audio queued for delivery"
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Send via Meta Cloud API (for non-audio messages - synchronous)
  try {
    const sendUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`;
    
    let metaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: messageType,
    };

    if (messageType === "text") {
      metaPayload.text = { body: payload.content };
    } else {
      // For image, video, document - use public URL directly (link method)
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

/**
 * Async audio processing function - runs in background after 202 response
 * Downloads audio, uploads to Meta /media, sends message
 */
async function processAudioAsync(
  supabase: any,
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  mediaUrl: string,
  messageId: string,
  contactId?: string,
  audioDuration?: number,
  mediaFilename?: string
): Promise<void> {
  try {
    console.log("[AUDIO-ASYNC] Starting background processing");
    console.log("[AUDIO-ASYNC] message_id:", messageId);
    console.log("[AUDIO-ASYNC] recipient:", recipientPhone);
    console.log("[AUDIO-ASYNC] duration_s:", audioDuration);
    console.log("[AUDIO-ASYNC] media_url:", mediaUrl);

    // Ensure DB status is processing (idempotent)
    await supabase.from("whatsapp_messages").update({ status: "processing" }).eq("id", messageId);

    if (typeof audioDuration === "number" && audioDuration < 1) {
      throw new Error("Audio duration < 1s (invalid)");
    }

    // Extract storage path (for auditing)
    const bucketMarker = "/whatsapp-media/";
    const storagePath = mediaUrl.includes(bucketMarker)
      ? mediaUrl.split(bucketMarker)[1]
      : null;
    console.log("[AUDIO-ASYNC] storage_path:", storagePath);
    
    // Step 1: Download audio from Supabase Storage
    console.log("[AUDIO-ASYNC] Downloading from:", mediaUrl);
    const audioResponse = await fetch(mediaUrl);
    
    if (!audioResponse.ok) {
      console.error("[AUDIO-ASYNC] Download failed:", audioResponse.status);
      throw new Error("Failed to download audio file");
    }
    
    const contentTypeHeader = audioResponse.headers.get("content-type") || undefined;
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log("[AUDIO-ASYNC] Downloaded size_bytes:", audioBuffer.byteLength);
    console.log("[AUDIO-ASYNC] Downloaded content-type:", contentTypeHeader);
    
    // Determine MIME type from URL or default to audio/ogg
    let mimeType = (contentTypeHeader || "").split(";")[0] || "audio/ogg";
    if (!mimeType.startsWith("audio/")) {
      mimeType = "audio/ogg";
    }
    console.log("[AUDIO-ASYNC] Detected MIME type:", mimeType);

    // We REQUIRE audio/ogg for WhatsApp compatibility
    if (mimeType !== "audio/ogg") {
      console.warn("[AUDIO-ASYNC] WARNING: mimeType is not audio/ogg. This may fail on Meta /media.");
    }
    
    // Step 2: Upload to Meta's /media endpoint
    console.log("[AUDIO-ASYNC] Uploading to Meta /media endpoint...");
    const mediaUploadUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/media`;
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    const filename = mediaFilename || (mimeType === "audio/ogg" ? "audio.ogg" : "audio.bin");
    formData.append("file", audioBlob, filename);
    formData.append("type", mimeType);
    formData.append("messaging_product", "whatsapp");
    
    const uploadResponse = await fetch(mediaUploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    
    const uploadResult = await uploadResponse.json();
    console.log("[AUDIO-ASYNC] /media status:", uploadResponse.status);
    console.log("[AUDIO-ASYNC] /media response:", JSON.stringify(uploadResult, null, 2));
    
    if (!uploadResponse.ok || !uploadResult.id) {
      console.error("[AUDIO-ASYNC] Meta upload failed:", uploadResult);
      throw new Error(uploadResult.error?.message || "Failed to upload audio to Meta");
    }
    
    const mediaId = uploadResult.id;
    console.log("[AUDIO-ASYNC] Media uploaded successfully, ID:", mediaId);
    
    // Step 3: Send message using media_id
    console.log("[AUDIO-ASYNC] Sending audio message...");
    const sendUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    const metaPayload = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "audio",
      audio: { id: mediaId }
    };
    
    console.log("[AUDIO-ASYNC] /messages payload:", JSON.stringify(metaPayload, null, 2));
    
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });
    
    const sendResult = await sendResponse.json();
    console.log("[AUDIO-ASYNC] /messages status:", sendResponse.status);
    console.log("[AUDIO-ASYNC] /messages response:", JSON.stringify(sendResult, null, 2));
    
    if (!sendResponse.ok) {
      console.error("[AUDIO-ASYNC] Send failed:", sendResult);
      throw new Error(sendResult.error?.message || "Failed to send audio message");
    }
    
    const metaMessageId = sendResult.messages?.[0]?.id;
    console.log("[AUDIO-ASYNC] SUCCESS! Meta message ID:", metaMessageId);
    
    // Update message status to sent
    await supabase
      .from("whatsapp_messages")
      .update({ 
        status: "sent",
        message_id: metaMessageId 
      })
      .eq("id", messageId);
    
    // Update contact last_message_at
    if (contactId) {
      await supabase
        .from("whatsapp_contacts")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", contactId);
    }
    
    console.log("[AUDIO-ASYNC] Message status updated to sent");
    
  } catch (error) {
    console.error("[AUDIO-ASYNC] Processing failed:", error);
    
    // Update message status to failed
    await supabase
      .from("whatsapp_messages")
      .update({ status: "failed" })
      .eq("id", messageId);
    
    console.log("[AUDIO-ASYNC] Message status updated to failed");
  }
}
