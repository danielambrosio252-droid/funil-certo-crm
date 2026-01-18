import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionPayload {
  action: "connect" | "disconnect" | "status" | "set_webhook";
  webhook_url?: string;
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

    // Validar token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Buscar perfil do usuário (precisa ser admin ou owner)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["owner", "admin"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para gerenciar sessão WhatsApp" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    const payload: SessionPayload = await req.json();
    const { action, webhook_url } = payload;

    console.log("Ação de sessão:", action, "empresa:", companyId);

    // Usar service role para operações de escrita
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case "connect": {
        // Verificar se já existe sessão
        const { data: existingSession } = await supabaseAdmin
          .from("whatsapp_sessions")
          .select("id, status, webhook_url")
          .eq("company_id", companyId)
          .single();

        if (!existingSession) {
          // Criar nova sessão
          const { error } = await supabaseAdmin
            .from("whatsapp_sessions")
            .insert({
              company_id: companyId,
              status: "connecting",
            });

          if (error) {
            console.error("Erro ao criar sessão:", error);
            throw error;
          }
        } else {
          // Atualizar para connecting
          await supabaseAdmin
            .from("whatsapp_sessions")
            .update({ status: "connecting", qr_code: null })
            .eq("company_id", companyId);
        }

        // Se tiver webhook configurado, notificar servidor externo
        const session = existingSession;
        if (session?.webhook_url) {
          try {
            await fetch(session.webhook_url + "/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
            });
          } catch (e) {
            console.error("Erro ao notificar servidor externo:", e);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "Iniciando conexão..." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { data: session } = await supabaseAdmin
          .from("whatsapp_sessions")
          .select("webhook_url")
          .eq("company_id", companyId)
          .single();

        // Desconectar
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ status: "disconnected", qr_code: null })
          .eq("company_id", companyId);

        // Notificar servidor externo
        if (session?.webhook_url) {
          try {
            await fetch(session.webhook_url + "/disconnect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
            });
          } catch (e) {
            console.error("Erro ao notificar servidor externo:", e);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "Desconectado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        const { data: session, error } = await supabase
          .from("whatsapp_sessions")
          .select("status, phone_number, qr_code, last_connected_at, webhook_url")
          .eq("company_id", companyId)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        return new Response(
          JSON.stringify({
            session: session || { status: "disconnected" },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set_webhook": {
        if (!webhook_url) {
          return new Response(
            JSON.stringify({ error: "webhook_url é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verificar se existe sessão
        const { data: existingSession } = await supabaseAdmin
          .from("whatsapp_sessions")
          .select("id")
          .eq("company_id", companyId)
          .single();

        if (existingSession) {
          await supabaseAdmin
            .from("whatsapp_sessions")
            .update({ webhook_url })
            .eq("company_id", companyId);
        } else {
          await supabaseAdmin
            .from("whatsapp_sessions")
            .insert({
              company_id: companyId,
              webhook_url,
              status: "disconnected",
            });
        }

        return new Response(
          JSON.stringify({ success: true, message: "Webhook configurado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Erro na sessão:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
