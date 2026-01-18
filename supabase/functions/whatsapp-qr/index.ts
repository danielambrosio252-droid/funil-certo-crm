import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Dedicated endpoint for polling QR code status.
 * GET /whatsapp-qr
 * 
 * Returns:
 * - { status: "QR", qr: "<base64>" } when QR is ready
 * - { status: "WAITING" } when still connecting
 * - { status: "CONNECTED" } when already connected
 * - { status: "ERROR" } when connection failed
 * - { status: "DISCONNECTED" } when no session
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
        JSON.stringify({ status: "ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    console.log(`[QR] company_id: ${companyId}, WHATSAPP_SERVER_URL: ${whatsappServerUrl ? 'SET' : 'NOT SET'}`);

    // Fetch session directly from database
    const { data: session, error } = await supabase
      .from("whatsapp_sessions")
      .select("status, qr_code, phone_number")
      .eq("company_id", companyId)
      .maybeSingle();

    console.log(`[QR] DB session status: ${session?.status}, has_qr: ${!!session?.qr_code}`);

    if (error) {
      console.error("Erro ao buscar sessão:", error);
      return new Response(
        JSON.stringify({ status: "ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session) {
      // Mesmo sem sessão no banco, ainda pode existir QR no servidor.
      // Vamos tentar buscar do servidor antes de responder DISCONNECTED.
      if (whatsappServerUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const resp = await fetch(
            `${whatsappServerUrl}/api/whatsapp/qr?company_id=${encodeURIComponent(companyId)}`,
            { method: "GET", signal: controller.signal }
          );

          clearTimeout(timeoutId);

          if (resp.ok) {
            const serverData = await resp.json();
            if (serverData?.status === "QR" && serverData.qr) {
              return new Response(
                JSON.stringify({ status: "QR", qr: serverData.qr }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (serverData?.status === "CONNECTED") {
              return new Response(
                JSON.stringify({ status: "CONNECTED", phone_number: serverData.phone_number }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (serverData?.status === "WAITING") {
              return new Response(
                JSON.stringify({ status: "WAITING" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (e) {
          console.error("Erro ao buscar QR no servidor:", e);
        }
      }

      return new Response(
        JSON.stringify({ status: "WAITING" }),
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
        JSON.stringify({ status: "ERROR" }),
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

    // Fallback: buscar QR diretamente do WhatsApp Server (cache em memória)
    if (whatsappServerUrl) {
      try {
        const url = `${whatsappServerUrl}/api/whatsapp/qr?company_id=${encodeURIComponent(companyId)}`;
        console.log(`[QR] Fetching from server: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(url, { method: "GET", signal: controller.signal });

        clearTimeout(timeoutId);
        console.log(`[QR] Server response status: ${resp.status}`);

        if (resp.ok) {
          const serverData = await resp.json();
          console.log(`[QR] Server data: ${JSON.stringify(serverData)}`);

          if (serverData?.status === "QR" && serverData.qr) {
            return new Response(
              JSON.stringify({ status: "QR", qr: serverData.qr }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (serverData?.status === "CONNECTED") {
            return new Response(
              JSON.stringify({ status: "CONNECTED", phone_number: serverData.phone_number }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (serverData?.status === "WAITING") {
            return new Response(
              JSON.stringify({ status: "WAITING" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (serverData?.status === "DISCONNECTED") {
            return new Response(
              JSON.stringify({ status: "WAITING" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (serverData?.status === "ERROR") {
            return new Response(
              JSON.stringify({ status: "ERROR" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const errorText = await resp.text();
          console.error(`[QR] Server error: ${resp.status} - ${errorText}`);
        }
      } catch (e) {
        console.error("[QR] Erro ao buscar QR no servidor:", e);
      }
    } else {
      console.log("[QR] No WHATSAPP_SERVER_URL configured");
    }

    // Still connecting, no QR yet
    return new Response(
      JSON.stringify({ status: "WAITING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ status: "ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
