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
  action: "connect" | "disconnect" | "status" | "restart" | "reset";
  force_reset?: boolean;
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
  const whatsappServerSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");

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
    const { action, force_reset } = payload;

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

    // Check permissions for connect/disconnect/restart/reset
    if (action !== "status" && !["owner", "admin"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para gerenciar sessão WhatsApp" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Headers para chamadas ao servidor VPS
    const serverHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (whatsappServerSecret) {
      serverHeaders["x-server-token"] = whatsappServerSecret;
    }

    console.log(`[whatsapp-session] Ação: ${action}, empresa: ${companyId}`);

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

        // Check/create session - set to "connecting" immediately
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
            .update({ 
              status: "connecting", 
              qr_code: null,
              updated_at: new Date().toISOString()
            })
            .eq("company_id", companyId);
        }

        // Notify WhatsApp server in background (non-blocking)
        const notifyServerInBackground = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            console.log(`[whatsapp-session] Chamando servidor: ${whatsappServerUrl}/connect`);
            const response = await fetch(whatsappServerUrl + "/connect", {
              method: "POST",
              headers: serverHeaders,
              body: JSON.stringify({ 
                company_id: companyId,
                force_reset: force_reset || false
              }),
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
            } else {
              const data = await response.json();
              console.log("Servidor WhatsApp respondeu:", data);
            }
          } catch (e) {
            console.error("Erro ao conectar ao servidor WhatsApp:", e);

            await supabaseAdmin
              .from("whatsapp_sessions")
              .update({ status: "error" })
              .eq("company_id", companyId);
          }
        };

        // Fire in background - don't wait
        runInBackground(notifyServerInBackground());

        // Return immediately with CONNECTING status
        return new Response(
          JSON.stringify({
            success: true,
            status: "CONNECTING",
            message: "Conexão iniciada. Use GET /whatsapp-qr para buscar o QR Code.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        // Update database immediately
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ 
            status: "disconnected", 
            qr_code: null,
            updated_at: new Date().toISOString()
          })
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
              const timeoutId = setTimeout(() => controller.abort(), 5000);

              await fetch(whatsappServerUrl + "/disconnect", {
                method: "POST",
                headers: serverHeaders,
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

      case "restart": {
        // Reinicia sessão (mantém credenciais do WhatsApp)
        if (!whatsappServerUrl) {
          return new Response(
            JSON.stringify({ error: "Servidor WhatsApp não configurado" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update database to connecting
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ 
            status: "connecting", 
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq("company_id", companyId);

        // Call restart endpoint in background
        runInBackground((async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            console.log(`[whatsapp-session] Reiniciando: ${whatsappServerUrl}/restart/${companyId}`);
            const response = await fetch(`${whatsappServerUrl}/restart/${companyId}`, {
              method: "POST",
              headers: serverHeaders,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.error("Erro ao reiniciar:", await response.text());
              await supabaseAdmin
                .from("whatsapp_sessions")
                .update({ status: "error" })
                .eq("company_id", companyId);
            }
          } catch (e) {
            console.error("Erro ao reiniciar sessão:", e);
            await supabaseAdmin
              .from("whatsapp_sessions")
              .update({ status: "error" })
              .eq("company_id", companyId);
          }
        })());

        return new Response(
          JSON.stringify({ success: true, status: "RESTARTING" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset": {
        // Remove sessão completamente (permite conectar novo número)
        if (!whatsappServerUrl) {
          return new Response(
            JSON.stringify({ error: "Servidor WhatsApp não configurado" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update database - clear everything
        await supabaseAdmin
          .from("whatsapp_sessions")
          .update({ 
            status: "disconnected", 
            qr_code: null,
            phone_number: null,
            updated_at: new Date().toISOString()
          })
          .eq("company_id", companyId);

        // Call delete endpoint in background
        runInBackground((async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            console.log(`[whatsapp-session] Removendo: DELETE ${whatsappServerUrl}/session/${companyId}`);
            await fetch(`${whatsappServerUrl}/session/${companyId}`, {
              method: "DELETE",
              headers: serverHeaders,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
          } catch (e) {
            console.error("Erro ao remover sessão:", e);
          }
        })());

        return new Response(
          JSON.stringify({ success: true, status: "RESET", message: "Sessão removida. Você pode conectar um novo número." }),
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
