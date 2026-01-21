/**
 * =====================================================
 * SCHEDULER PARA PROCESSAR DELAYS DE FLUXOS
 * =====================================================
 * 
 * Deve ser chamado periodicamente (ex: a cada 1 minuto via cron)
 * para processar execuções que estão aguardando (status = 'waiting')
 * e cujo next_action_at já passou.
 * 
 * URL: POST /flow-scheduler
 * 
 * Também pode ser acionado manualmente para processar delays pendentes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();
    
    // Buscar execuções prontas para continuar (delay expirado)
    const { data: readyExecutions, error: queryError } = await supabase
      .from("whatsapp_flow_executions")
      .select("id, flow_id, company_id")
      .eq("status", "waiting")
      .not("next_action_at", "is", null)
      .lte("next_action_at", now)
      .limit(50); // Processar em lotes

    if (queryError) {
      console.error("[FlowScheduler] Erro ao buscar execuções:", queryError);
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!readyExecutions || readyExecutions.length === 0) {
      console.log("[FlowScheduler] Nenhuma execução pendente");
      return new Response(
        JSON.stringify({ message: "No pending executions", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FlowScheduler] ${readyExecutions.length} execuções prontas para continuar`);

    let processed = 0;
    let errors = 0;

    // Processar cada execução
    for (const execution of readyExecutions) {
      try {
        // Chamar flow-executor para continuar a execução
        const response = await fetch(`${supabaseUrl}/functions/v1/flow-executor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            trigger_type: "continue_execution",
            company_id: execution.company_id,
            execution_id: execution.id,
          }),
        });

        if (response.ok) {
          processed++;
          console.log(`[FlowScheduler] ✅ Execução retomada: ${execution.id}`);
        } else {
          errors++;
          console.error(`[FlowScheduler] ❌ Erro ao retomar: ${execution.id}`);
        }
      } catch (err) {
        errors++;
        console.error(`[FlowScheduler] Erro:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        errors,
        total: readyExecutions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[FlowScheduler] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
