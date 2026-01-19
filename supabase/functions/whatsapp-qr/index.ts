import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ENDPOINT DETERMINÍSTICO para polling de QR code
 * GET /whatsapp-qr
 * 
 * Retorna status EXPLÍCITO (NUNCA WAITING infinito):
 * - { status: "QR", qr: "<base64>" } quando QR está pronto
 * - { status: "CONNECTING" } quando está iniciando (max 30s)
 * - { status: "CONNECTED", phone_number: "..." } quando já conectado
 * - { status: "ERROR", reason: "..." } quando falhou
 * - { status: "DISCONNECTED" } quando sem sessão
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ status: "ERROR", reason: "no_profile" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    console.log(`[QR] company_id: ${companyId}`);

    // ESTRATÉGIA: Buscar do servidor VPS primeiro (fonte de verdade em tempo real)
    // O servidor VPS tem o estado mais atualizado (QR em memória, status real)
    if (whatsappServerUrl) {
      try {
        const whatsappServerSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // O servidor VPS usa a rota /status?company_id=... (não /api/whatsapp/qr)
        const url = `${whatsappServerUrl}/status?company_id=${encodeURIComponent(companyId)}`;
        console.log(`[QR] Fetching from VPS: ${url}`);
        
        const headers: Record<string, string> = {};
        if (whatsappServerSecret) {
          headers["x-server-token"] = whatsappServerSecret;
        }

        const resp = await fetch(url, { 
          method: "GET", 
          headers,
          signal: controller.signal 
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
          const serverData = await resp.json();
          console.log(`[QR] VPS response: ${JSON.stringify(serverData)}`);

          // Mapear resposta do servidor para frontend
          // O servidor antigo retorna { company_id, status, connected }
          // O servidor novo (v3) retorna { status: "CONNECTED"|"QR"|etc, qr?, phone_number? }
          
          const status = serverData?.status?.toUpperCase?.() || serverData?.status;
          
          if (status === "CONNECTED" || serverData?.connected === true) {
            return new Response(
              JSON.stringify({ 
                status: "CONNECTED", 
                phone_number: serverData.phone_number 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (status === "QR" && serverData.qr) {
            return new Response(
              JSON.stringify({ status: "QR", qr: serverData.qr }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (status === "QR_CODE" && serverData.qr) {
            return new Response(
              JSON.stringify({ status: "QR", qr: serverData.qr }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (status === "CONNECTING" || status === "RECONNECTING") {
            return new Response(
              JSON.stringify({ 
                status: "CONNECTING",
                pending_age_ms: serverData.pending_age_ms || 0
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (status === "ERROR") {
            return new Response(
              JSON.stringify({ 
                status: "ERROR", 
                reason: serverData.reason || "unknown" 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (status === "DISCONNECTED" || status === "NOT_FOUND") {
            return new Response(
              JSON.stringify({ status: "DISCONNECTED" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Qualquer outro status não mapeado -> continuar para DB fallback
          console.log(`[QR] VPS status não mapeado: ${status}`);
        } else {
          console.error(`[QR] VPS error: ${resp.status}`);
        }
      } catch (e) {
        console.error("[QR] Erro ao buscar do VPS:", e);
        // Continuar para fallback do banco de dados
      }
    } else {
      console.log("[QR] WHATSAPP_SERVER_URL não configurado");
    }

    // FALLBACK: Buscar do banco de dados
    const { data: session, error } = await supabase
      .from("whatsapp_sessions")
      .select("status, qr_code, phone_number")
      .eq("company_id", companyId)
      .maybeSingle();

    console.log(`[QR] DB fallback - status: ${session?.status}, has_qr: ${!!session?.qr_code}`);

    if (error) {
      console.error("Erro ao buscar sessão:", error);
      return new Response(
        JSON.stringify({ status: "ERROR", reason: "db_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session) {
      return new Response(
        JSON.stringify({ status: "DISCONNECTED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map database status to API response
    const dbStatus = session.status;

    if (dbStatus === "connected") {
      return new Response(
        JSON.stringify({
          status: "CONNECTED",
          phone_number: session.phone_number,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dbStatus === "error") {
      return new Response(
        JSON.stringify({ status: "ERROR", reason: "session_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dbStatus === "qr_code" && session.qr_code) {
      return new Response(
        JSON.stringify({
          status: "QR",
          qr: session.qr_code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dbStatus === "connecting") {
      return new Response(
        JSON.stringify({ status: "CONNECTING" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: disconnected
    return new Response(
      JSON.stringify({ status: "DISCONNECTED" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ status: "ERROR", reason: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
