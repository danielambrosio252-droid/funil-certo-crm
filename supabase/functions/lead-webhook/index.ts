/**
 * =====================================================
 * WEBHOOK PARA RECEBER LEADS EXTERNOS
 * =====================================================
 * 
 * Endpoint para receber leads de formulários externos.
 * 
 * URL: https://ysiszrxwbargoyqrrehr.supabase.co/functions/v1/lead-webhook
 * 
 * CAMPOS OBRIGATÓRIOS:
 * - name: string (nome do lead)
 * 
 * CAMPOS OPCIONAIS:
 * - email: string (e-mail do lead)
 * - phone: string (telefone do lead)
 * - value: number (valor potencial)
 * - source: string (origem - ex: "Facebook", "Google", "Site")
 * - tags: string[] (tags para categorização)
 * - notes: string (observações adicionais)
 * - funnel_id: string (UUID do funil - se não informado, usa o padrão)
 * - stage_id: string (UUID do estágio - se não informado, usa o primeiro do funil)
 * 
 * HEADERS OBRIGATÓRIOS:
 * - X-Webhook-Secret: string (token de autenticação)
 * - Content-Type: application/json
 * 
 * EXEMPLO DE PAYLOAD:
 * {
 *   "name": "João Silva",
 *   "email": "joao@email.com",
 *   "phone": "11999999999",
 *   "value": 1500,
 *   "source": "Facebook Ads",
 *   "tags": ["interessado", "facebook"],
 *   "notes": "Interessado no produto X"
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-webhook-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LeadPayload {
  name: string;
  email?: string;
  phone?: string;
  value?: number;
  source?: string;
  tags?: string[];
  notes?: string;
  funnel_id?: string;
  stage_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar secret do webhook
    const receivedSecret = req.headers.get("X-Webhook-Secret");
    
    if (!receivedSecret) {
      console.warn("[Lead Webhook] Missing X-Webhook-Secret header");
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized", 
          message: "Header X-Webhook-Secret is required" 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar config do webhook pelo secret
    const { data: webhookConfig, error: configError } = await supabase
      .from("webhook_configs")
      .select("*, companies(*)")
      .eq("webhook_secret", receivedSecret)
      .eq("is_active", true)
      .single();

    if (configError || !webhookConfig) {
      console.warn("[Lead Webhook] Invalid or inactive webhook secret");
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized", 
          message: "Invalid or inactive webhook secret" 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = webhookConfig.company_id;
    console.log(`[Lead Webhook] Recebendo lead para empresa: ${companyId}`);

    // Parse payload
    const payload: LeadPayload = await req.json();

    // Validar campo obrigatório
    if (!payload.name || typeof payload.name !== "string" || payload.name.trim() === "") {
      return new Response(
        JSON.stringify({ 
          error: "Validation error", 
          message: "Field 'name' is required and must be a non-empty string" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar funil e estágio
    let funnelId = payload.funnel_id || webhookConfig.default_funnel_id;
    let stageId = payload.stage_id || webhookConfig.default_stage_id;

    // Se não tem funil definido, buscar o funil padrão da empresa
    if (!funnelId) {
      const { data: defaultFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("company_id", companyId)
        .eq("is_default", true)
        .single();

      if (defaultFunnel) {
        funnelId = defaultFunnel.id;
      } else {
        // Pegar o primeiro funil disponível
        const { data: firstFunnel } = await supabase
          .from("funnels")
          .select("id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (!firstFunnel) {
          return new Response(
            JSON.stringify({ 
              error: "Configuration error", 
              message: "No funnel found for this company. Please create a funnel first." 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        funnelId = firstFunnel.id;
      }
    }

    // Se não tem estágio definido, pegar o primeiro do funil
    if (!stageId) {
      const { data: firstStage } = await supabase
        .from("funnel_stages")
        .select("id")
        .eq("funnel_id", funnelId)
        .order("position", { ascending: true })
        .limit(1)
        .single();

      if (!firstStage) {
        return new Response(
          JSON.stringify({ 
            error: "Configuration error", 
            message: "No stage found for the funnel. Please create stages first." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      stageId = firstStage.id;
    }

    // Calcular posição do lead no estágio
    const { count } = await supabase
      .from("funnel_leads")
      .select("*", { count: "exact", head: true })
      .eq("stage_id", stageId);

    const position = (count || 0) + 1;

    // Criar o lead
    const { data: newLead, error: leadError } = await supabase
      .from("funnel_leads")
      .insert({
        company_id: companyId,
        stage_id: stageId,
        name: payload.name.trim(),
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        value: payload.value || 0,
        source: payload.source?.trim() || "Webhook",
        tags: payload.tags || [],
        notes: payload.notes?.trim() || null,
        position,
      })
      .select()
      .single();

    if (leadError) {
      console.error("[Lead Webhook] Error creating lead:", leadError);
      return new Response(
        JSON.stringify({ 
          error: "Database error", 
          message: "Failed to create lead" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Lead Webhook] Lead criado com sucesso: ${newLead.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lead created successfully",
        lead: {
          id: newLead.id,
          name: newLead.name,
          stage_id: newLead.stage_id,
          created_at: newLead.created_at,
        }
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Lead Webhook] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
