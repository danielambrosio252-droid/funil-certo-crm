import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface CreateTemplatePayload {
  action: "create";
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

interface ListTemplatesPayload {
  action: "list";
  status?: string;
  limit?: number;
}

interface DeleteTemplatePayload {
  action: "delete";
  template_name: string;
}

interface SendTemplatePayload {
  action: "send";
  contact_id?: string;
  phone?: string;
  template_name: string;
  template_language: string;
  components?: Array<{
    type: "header" | "body" | "button";
    parameters?: Array<{
      type: "text" | "image" | "video" | "document";
      text?: string;
      image?: { link: string };
      video?: { link: string };
      document?: { link: string; filename?: string };
    }>;
    sub_type?: "quick_reply" | "url";
    index?: string;
  }>;
}

type RequestPayload = CreateTemplatePayload | ListTemplatesPayload | DeleteTemplatePayload | SendTemplatePayload;

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

  // Get company's cloud API config
  const { data: company } = await supabase
    .from("companies")
    .select("whatsapp_mode, whatsapp_phone_number_id, whatsapp_waba_id")
    .eq("id", profile.company_id)
    .single();

  if (!cloudAccessToken) {
    return new Response(
      JSON.stringify({ error: "Cloud API access token not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!company?.whatsapp_waba_id) {
    return new Response(
      JSON.stringify({ error: "WhatsApp Business Account ID not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const payload: RequestPayload = await req.json();

  // LIST TEMPLATES
  if (payload.action === "list") {
    try {
      const params = new URLSearchParams();
      if (payload.status) params.append("status", payload.status);
      params.append("limit", String(payload.limit || 100));
      params.append("fields", "name,status,category,language,components,quality_score,rejected_reason");

      const listUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_waba_id}/message_templates?${params}`;
      
      const response = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${cloudAccessToken}` },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Meta API error listing templates:", result);
        return new Response(
          JSON.stringify({ error: result.error?.message || "Failed to list templates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          templates: result.data || [],
          paging: result.paging
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Error listing templates:", err);
      return new Response(
        JSON.stringify({ error: "Failed to fetch templates" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // CREATE TEMPLATE
  if (payload.action === "create") {
    try {
      const createUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_waba_id}/message_templates`;
      
      const templatePayload = {
        name: payload.name,
        language: payload.language,
        category: payload.category,
        components: payload.components,
        allow_category_change: payload.allow_category_change ?? true,
      };

      console.log("Creating template:", JSON.stringify(templatePayload, null, 2));

      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
      });

      const result = await response.json();
      console.log("Create template response:", result);

      if (!response.ok) {
        console.error("Meta API error creating template:", result);
        return new Response(
          JSON.stringify({ 
            error: result.error?.message || "Failed to create template",
            error_user_title: result.error?.error_user_title,
            error_user_msg: result.error?.error_user_msg
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          template_id: result.id,
          status: result.status
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Error creating template:", err);
      return new Response(
        JSON.stringify({ error: "Failed to create template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // DELETE TEMPLATE
  if (payload.action === "delete") {
    try {
      const deleteUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_waba_id}/message_templates?name=${encodeURIComponent(payload.template_name)}`;
      
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cloudAccessToken}` },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Meta API error deleting template:", result);
        return new Response(
          JSON.stringify({ error: result.error?.message || "Failed to delete template" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Error deleting template:", err);
      return new Response(
        JSON.stringify({ error: "Failed to delete template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // SEND TEMPLATE MESSAGE
  if (payload.action === "send") {
    if (!company.whatsapp_phone_number_id) {
      return new Response(
        JSON.stringify({ error: "Phone Number ID not configured" }),
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
        .eq("company_id", profile.company_id)
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

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ error: "Missing phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const sendUrl = `https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`;
      
      const messagePayload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "template",
        template: {
          name: payload.template_name,
          language: { code: payload.template_language },
        },
      };

      // Add components if provided (for dynamic content)
      if (payload.components && payload.components.length > 0) {
        (messagePayload.template as Record<string, unknown>).components = payload.components;
      }

      console.log("Sending template message:", JSON.stringify(messagePayload, null, 2));

      const response = await fetch(sendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      });

      const result = await response.json();
      console.log("Send template response:", result, "Status:", response.status);

      if (!response.ok) {
        console.error("Meta API error sending template:", result);
        return new Response(
          JSON.stringify({ error: result.error?.message || "Failed to send template message" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaMessageId = result.messages?.[0]?.id;

      // Create message record
      const messageContent = `[TEMPLATE: ${payload.template_name}]`;
      
      const messageInsert: Record<string, unknown> = {
        company_id: profile.company_id,
        content: messageContent,
        is_from_me: true,
        status: "sent",
        message_type: "template",
        message_id: metaMessageId,
        sent_at: new Date().toISOString(),
      };

      if (contactId) {
        messageInsert.contact_id = contactId;
      } else {
        // Find or create contact
        const { data: existingContact } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("normalized_phone", recipientPhone)
          .maybeSingle();

        if (existingContact) {
          messageInsert.contact_id = existingContact.id;
        } else {
          const { data: newContact } = await supabase
            .from("whatsapp_contacts")
            .insert({
              company_id: profile.company_id,
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

      await supabase.from("whatsapp_messages").insert(messageInsert);

      // Update contact last_message_at
      if (messageInsert.contact_id) {
        await supabase
          .from("whatsapp_contacts")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", messageInsert.contact_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          meta_message_id: metaMessageId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Error sending template message:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send template message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Invalid action" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
