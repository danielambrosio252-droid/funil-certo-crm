import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessagePayload {
  contact_id: string;
  content: string;
  message_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const whatsappServerUrl = Deno.env.get("WHATSAPP_SERVER_URL");

    // Validar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Buscar perfil e empresa do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    const payload: SendMessagePayload = await req.json();
    const { contact_id, content, message_type = "text" } = payload;

    console.log("Enviando mensagem para contato:", contact_id);

    // Buscar contato e sessão
    const { data: contact, error: contactError } = await supabase
      .from("whatsapp_contacts")
      .select("phone, company_id")
      .eq("id", contact_id)
      .eq("company_id", companyId)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar sessão ativa
    const { data: session, error: sessionError } = await supabase
      .from("whatsapp_sessions")
      .select("status")
      .eq("company_id", companyId)
      .single();

    if (sessionError || !session || session.status !== "connected") {
      return new Response(
        JSON.stringify({ error: "WhatsApp não conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar mensagem no banco com status pending
    const { data: message, error: msgError } = await supabase
      .from("whatsapp_messages")
      .insert({
        company_id: companyId,
        contact_id,
        content,
        message_type,
        is_from_me: true,
        status: "pending",
      })
      .select("id")
      .single();

    if (msgError) {
      console.error("Erro ao criar mensagem:", msgError);
      throw msgError;
    }

    // Atualizar última mensagem do contato
    await supabase
      .from("whatsapp_contacts")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", contact_id);

    // Enviar para o servidor WhatsApp (URL protegida no backend)
    if (whatsappServerUrl) {
      try {
        const whatsappServerSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (whatsappServerSecret) {
          headers["x-server-token"] = whatsappServerSecret;
        }

        console.log(`[whatsapp-send] Enviando para: ${whatsappServerUrl}/send`);
        const response = await fetch(whatsappServerUrl + "/send", {
          method: "POST",
          headers,
          body: JSON.stringify({
            company_id: companyId,
            message_id: message.id,
            phone: contact.phone,
            message: content,
            message_type,
          }),
        });

        if (!response.ok) {
          console.error("Erro ao enviar para servidor WhatsApp:", await response.text());
          // Marcar mensagem como falha
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
          
          await supabaseAdmin
            .from("whatsapp_messages")
            .update({ status: "failed" })
            .eq("id", message.id);
        }
      } catch (fetchError) {
        console.error("Erro de conexão com servidor WhatsApp:", fetchError);
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabaseAdmin
          .from("whatsapp_messages")
          .update({ status: "failed" })
          .eq("id", message.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message_id: message.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
