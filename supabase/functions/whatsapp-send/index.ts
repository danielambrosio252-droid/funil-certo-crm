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

    // Validar token e obter usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

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
      .select("status, webhook_url")
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

    // Enviar para o servidor externo Node.js via webhook
    if (session.webhook_url) {
      try {
        const response = await fetch(session.webhook_url + "/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: message.id,
            phone: contact.phone,
            content,
            message_type,
          }),
        });

        if (!response.ok) {
          console.error("Erro ao enviar para servidor externo:", await response.text());
          // Marcar mensagem como falha
          await supabase
            .from("whatsapp_messages")
            .update({ status: "failed" })
            .eq("id", message.id);
        }
      } catch (fetchError) {
        console.error("Erro de conexão com servidor externo:", fetchError);
        await supabase
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
