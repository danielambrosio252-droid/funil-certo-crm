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
        JSON.stringify({ status: "DISCONNECTED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch session directly from database
    const { data: session, error } = await supabase
      .from("whatsapp_sessions")
      .select("status, qr_code, phone_number")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar sessão:", error);
      return new Response(
        JSON.stringify({ status: "ERROR" }),
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
          phone_number: session.phone_number 
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
          qr: session.qr_code 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
