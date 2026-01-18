import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionPayload {
  action: "connect" | "disconnect" | "status";
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
    const { action } = payload;

    console.log("Ação de sessão:", action, "empresa:", companyId);

    // Usar service role para operações de escrita
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o servidor WhatsApp está configurado
    if (!whatsappServerUrl && action !== "status") {
      return new Response(
        JSON.stringify({ 
          error: "Servidor WhatsApp não configurado",
          message: "Configure o WHATSAPP_SERVER_URL nas configurações do backend."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "connect": {
        // Verificar se já existe sessão
        const { data: existingSession } = await supabaseAdmin
          .from("whatsapp_sessions")
          .select("id, status")
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

        // Notificar servidor WhatsApp (URL protegida no backend)
        if (whatsappServerUrl) {
          try {
            console.log("Chamando servidor WhatsApp:", whatsappServerUrl + "/connect");
            const response = await fetch(whatsappServerUrl + "/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Erro do servidor WhatsApp:", errorText);
              
              // Atualizar status para erro
              await supabaseAdmin
                .from("whatsapp_sessions")
                .update({ status: "error" })
                .eq("company_id", companyId);
              
              return new Response(
                JSON.stringify({ error: "Falha ao comunicar com servidor WhatsApp" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            console.log("Servidor WhatsApp respondeu com sucesso");
          } catch (e) {
            console.error("Erro ao conectar ao servidor WhatsApp:", e);
            
            // Atualizar status para erro
            await supabaseAdmin
              .from("whatsapp_sessions")
              .update({ status: "error" })
              .eq("company_id", companyId);
            
            return new Response(
              JSON.stringify({ error: "Servidor WhatsApp indisponível" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "Iniciando conexão..." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        // Desconectar
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ status: "disconnected", qr_code: null })
          .eq("company_id", companyId);

        // Notificar servidor WhatsApp
        if (whatsappServerUrl) {
          try {
            await fetch(whatsappServerUrl + "/disconnect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
            });
          } catch (e) {
            console.error("Erro ao notificar desconexão:", e);
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
          .select("status, phone_number, qr_code, last_connected_at")
          .eq("company_id", companyId)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        return new Response(
          JSON.stringify({
            session: session || { status: "disconnected" },
            server_configured: !!whatsappServerUrl,
          }),
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
