import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Provided by the Edge Runtime (Supabase)
declare const EdgeRuntime:
  | {
      waitUntil: (promise: Promise<unknown>) => void;
    }
  | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionPayload {
  action: "connect" | "disconnect" | "status";
}

const runInBackground = (promise: Promise<unknown>) => {
  try {
    if (EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(promise);
      return;
    }
  } catch {
    // ignore
  }

  promise.catch((e) => console.error("Background task failed:", e));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const whatsappServerUrl = Deno.env.get("WHATSAPP_SERVER_URL");

  try {
    // Validate auth
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    // Handle missing profile gracefully for status action
    const payload: SessionPayload = await req.json();
    const { action } = payload;

    if (!profile?.company_id) {
      // For status, return disconnected immediately
      if (action === "status") {
        return new Response(
          JSON.stringify({
            session: { status: "disconnected" },
            server_configured: !!whatsappServerUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // For other actions, require profile
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check permissions for connect/disconnect
    if (action !== "status" && !["owner", "admin"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para gerenciar sessão WhatsApp" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Ação de sessão:", action, "empresa:", companyId);

    switch (action) {
      case "status": {
        // FAST: Just read from database, no external calls
        const { data: session, error } = await supabase
          .from("whatsapp_sessions")
          .select("status, phone_number, qr_code, last_connected_at")
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          console.error("Erro ao buscar status:", error);
        }

        return new Response(
          JSON.stringify({
            session: session || { status: "disconnected" },
            server_configured: !!whatsappServerUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "connect": {
        // Check if WhatsApp server is configured
        if (!whatsappServerUrl) {
          return new Response(
            JSON.stringify({
              error: "Servidor WhatsApp não configurado",
              message: "Configure o WHATSAPP_SERVER_URL nas configurações do backend.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check/create session
        const { data: existingSession } = await supabaseAdmin
          .from("whatsapp_sessions")
          .select("id, status")
          .eq("company_id", companyId)
          .maybeSingle();

        if (!existingSession) {
          await supabaseAdmin.from("whatsapp_sessions").insert({
            company_id: companyId,
            status: "connecting",
          });
        } else {
          await supabaseAdmin
            .from("whatsapp_sessions")
            .update({ status: "connecting", qr_code: null })
            .eq("company_id", companyId);
        }

        // Notify WhatsApp server (blocking up to ~5s). This avoids "fire-and-forget" being
        // cancelled by the runtime, which could leave the UI stuck in "connecting" forever.
        const notifyServer = async (): Promise<boolean> => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            console.log("Chamando servidor WhatsApp:", whatsappServerUrl + "/connect");
            const response = await fetch(whatsappServerUrl + "/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Erro do servidor WhatsApp:", errorText);

              await supabaseAdmin
                .from("whatsapp_sessions")
                .update({ status: "error" })
                .eq("company_id", companyId);

              return false;
            }

            console.log("Servidor WhatsApp respondeu com sucesso");
            return true;
          } catch (e) {
            console.error("Erro ao conectar ao servidor WhatsApp:", e);

            await supabaseAdmin
              .from("whatsapp_sessions")
              .update({ status: "error" })
              .eq("company_id", companyId);

            return false;
          }
        };

        const serverOk = await notifyServer();

        return new Response(
          JSON.stringify({
            success: true,
            server_ok: serverOk,
            message: serverOk
              ? "Conexão iniciada. Aguarde o QR Code."
              : "Não foi possível contatar o servidor do WhatsApp.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        // Update database immediately
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ status: "disconnected", qr_code: null })
          .eq("company_id", companyId);

        // Respond to user immediately
        const response = new Response(
          JSON.stringify({ success: true, message: "Desconectado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

        // Notify WhatsApp server (non-blocking)
        if (whatsappServerUrl) {
          const notifyDisconnect = async () => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);

              await fetch(whatsappServerUrl + "/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);
            } catch (e) {
              console.error("Erro ao notificar desconexão:", e);
            }
          };

          runInBackground(notifyDisconnect());
        }

        return response;
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
