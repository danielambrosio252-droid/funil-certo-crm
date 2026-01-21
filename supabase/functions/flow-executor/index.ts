/**
 * =====================================================
 * MOTOR DE EXECUÇÃO DE FLUXOS WHATSAPP
 * =====================================================
 * 
 * Executa fluxos de automação de forma segura, sem loops.
 * 
 * TRIGGERS SUPORTADOS:
 * - new_lead: Quando um novo lead é criado
 * - keyword: Quando uma mensagem contém palavra-chave
 * - stage_change: Quando lead muda de estágio
 * - schedule: Execução agendada (processada pelo scheduler)
 * 
 * ANTI-LOOP:
 * - Verifica execuções ativas antes de iniciar nova
 * - Limita 1 execução por contato/fluxo por vez
 * - Timeout automático após 24 horas
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriggerPayload {
  trigger_type: "new_lead" | "keyword" | "stage_change" | "continue_execution";
  company_id: string;
  contact_id?: string;
  lead_id?: string;
  message_content?: string;
  funnel_id?: string;
  stage_id?: string;
  execution_id?: string; // Para continuar execução após delay
}

interface FlowNode {
  id: string;
  node_type: string;
  config: Record<string, unknown>;
}

interface FlowEdge {
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
}

interface ExecutionContext {
  contact_name?: string;
  contact_phone?: string;
  lead_name?: string;
  lead_email?: string;
  lead_value?: number;
  last_message?: string;
  collected_data?: Record<string, unknown>;
}

// Substitui variáveis no texto
function replaceVariables(text: string, context: ExecutionContext): string {
  let result = text;
  
  const vars: Record<string, string> = {
    "{nome_lead}": context.lead_name || context.contact_name || "",
    "{nome_contato}": context.contact_name || "",
    "{primeiro_nome}": (context.contact_name || "").split(" ")[0],
    "{telefone}": context.contact_phone || "",
    "{email}": context.lead_email || "",
    "{valor_lead}": context.lead_value ? `R$ ${context.lead_value.toFixed(2)}` : "",
    "{ultima_mensagem}": context.last_message || "",
  };

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

// Verifica se está dentro do horário de execução
function isWithinSchedule(scheduleConfig: Record<string, unknown>): boolean {
  if (!scheduleConfig || Object.keys(scheduleConfig).length === 0) {
    return true; // Sem restrição de horário
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // HH:mm

  const days = scheduleConfig.days as number[] | undefined;
  const startTime = scheduleConfig.start_time as string | undefined;
  const endTime = scheduleConfig.end_time as string | undefined;

  // Verifica dia da semana
  if (days && days.length > 0 && !days.includes(dayOfWeek)) {
    return false;
  }

  // Verifica horário
  if (startTime && currentTime < startTime) return false;
  if (endTime && currentTime > endTime) return false;

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: TriggerPayload = await req.json();
    const { trigger_type, company_id, contact_id, lead_id, message_content, funnel_id, stage_id, execution_id } = payload;

    console.log(`[FlowExecutor] Trigger: ${trigger_type} | Company: ${company_id}`);

    // ===== CONTINUAR EXECUÇÃO EXISTENTE (após delay) =====
    if (trigger_type === "continue_execution" && execution_id) {
      return await continueExecution(supabase, execution_id);
    }

    // ===== BUSCAR FLUXOS ATIVOS PARA O TRIGGER =====
    let flowsQuery = supabase
      .from("whatsapp_flows")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .eq("trigger_type", trigger_type);

    const { data: flows, error: flowsError } = await flowsQuery;

    if (flowsError || !flows || flows.length === 0) {
      console.log(`[FlowExecutor] Nenhum fluxo ativo para trigger: ${trigger_type}`);
      return new Response(JSON.stringify({ message: "No active flows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let executedFlows = 0;

    for (const flow of flows) {
      const triggerConfig = flow.trigger_config as Record<string, unknown>;
      const scheduleConfig = flow.schedule_config as Record<string, unknown>;

      // ===== VERIFICAR CONDIÇÕES DO TRIGGER =====
      
      // new_lead: verificar se funil/estágio corresponde
      if (trigger_type === "new_lead") {
        if (triggerConfig.funnel_id && triggerConfig.funnel_id !== funnel_id) continue;
        if (triggerConfig.stage_id && triggerConfig.stage_id !== stage_id) continue;
      }

      // keyword: verificar se mensagem contém palavra-chave
      if (trigger_type === "keyword" && message_content) {
        const keywords = (triggerConfig.keywords || []) as string[];
        const lowerMessage = message_content.toLowerCase();
        const hasKeyword = keywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;
      }

      // stage_change: verificar estágio alvo
      if (trigger_type === "stage_change") {
        if (triggerConfig.stage_id && triggerConfig.stage_id !== stage_id) continue;
      }

      // ===== VERIFICAR HORÁRIO PERMITIDO =====
      if (!isWithinSchedule(scheduleConfig)) {
        console.log(`[FlowExecutor] Fora do horário: ${flow.name}`);
        continue;
      }

      // ===== ANTI-LOOP: Verificar execução ativa =====
      const { data: activeExecution } = await supabase
        .from("whatsapp_flow_executions")
        .select("id, started_at")
        .eq("flow_id", flow.id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting"])
        .maybeSingle();

      if (activeExecution) {
        // Verificar timeout (24 horas)
        const startedAt = new Date(activeExecution.started_at);
        const hoursElapsed = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed < 24) {
          console.log(`[FlowExecutor] Execução já ativa para contato: ${contact_id}`);
          continue; // Pular este fluxo - já está em execução
        } else {
          // Marcar como falha por timeout
          await supabase
            .from("whatsapp_flow_executions")
            .update({ status: "failed", completed_at: new Date().toISOString() })
            .eq("id", activeExecution.id);
        }
      }

      // ===== BUSCAR NÓ INICIAL =====
      const { data: startNode } = await supabase
        .from("whatsapp_flow_nodes")
        .select("id")
        .eq("flow_id", flow.id)
        .eq("node_type", "start")
        .single();

      if (!startNode) {
        console.error(`[FlowExecutor] Nó inicial não encontrado: ${flow.name}`);
        continue;
      }

      // ===== BUSCAR CONTEXTO DO CONTATO/LEAD =====
      let context: ExecutionContext = {};

      if (contact_id) {
        const { data: contact } = await supabase
          .from("whatsapp_contacts")
          .select("name, phone")
          .eq("id", contact_id)
          .single();
        
        if (contact) {
          context.contact_name = contact.name || "";
          context.contact_phone = contact.phone;
        }
      }

      if (lead_id) {
        const { data: lead } = await supabase
          .from("funnel_leads")
          .select("name, email, phone, value")
          .eq("id", lead_id)
          .single();
        
        if (lead) {
          context.lead_name = lead.name;
          context.lead_email = lead.email || "";
          context.lead_value = lead.value;
          if (!context.contact_phone && lead.phone) {
            context.contact_phone = lead.phone;
          }
        }
      }

      if (message_content) {
        context.last_message = message_content;
      }

      // ===== CRIAR EXECUÇÃO =====
      const { data: execution, error: execError } = await supabase
        .from("whatsapp_flow_executions")
        .insert({
          flow_id: flow.id,
          company_id,
          contact_id: contact_id || null,
          lead_id: lead_id || null,
          current_node_id: startNode.id,
          status: "running",
          context: context as unknown,
        })
        .select()
        .single();

      if (execError) {
        console.error(`[FlowExecutor] Erro ao criar execução:`, execError);
        continue;
      }

      console.log(`[FlowExecutor] ▶️ Iniciando execução: ${execution.id} | Fluxo: ${flow.name}`);

      // ===== EXECUTAR FLUXO =====
      await executeFlow(supabase, execution.id, flow.id, company_id, context);
      executedFlows++;
    }

    return new Response(
      JSON.stringify({ success: true, executed_flows: executedFlows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[FlowExecutor] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== CONTINUAR EXECUÇÃO APÓS DELAY =====
async function continueExecution(supabase: ReturnType<typeof createClient>, executionId: string) {
  const { data: execution, error } = await supabase
    .from("whatsapp_flow_executions")
    .select("*, whatsapp_flows(*)")
    .eq("id", executionId)
    .single();

  if (error || !execution) {
    return new Response(JSON.stringify({ error: "Execução não encontrada" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (execution.status !== "waiting") {
    return new Response(JSON.stringify({ message: "Execução não está aguardando" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Atualizar status para running
  await supabase
    .from("whatsapp_flow_executions")
    .update({ status: "running", next_action_at: null })
    .eq("id", executionId);

  // Continuar execução
  await executeFlow(
    supabase,
    executionId,
    execution.flow_id,
    execution.company_id,
    (execution.context || {}) as ExecutionContext
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== EXECUTAR FLUXO =====
async function executeFlow(
  supabase: ReturnType<typeof createClient>,
  executionId: string,
  flowId: string,
  companyId: string,
  context: ExecutionContext
) {
  // Buscar todos os nós e edges do fluxo
  const [nodesRes, edgesRes, execRes] = await Promise.all([
    supabase.from("whatsapp_flow_nodes").select("*").eq("flow_id", flowId),
    supabase.from("whatsapp_flow_edges").select("*").eq("flow_id", flowId),
    supabase.from("whatsapp_flow_executions").select("current_node_id, contact_id").eq("id", executionId).single(),
  ]);

  const nodes = (nodesRes.data || []) as FlowNode[];
  const edges = (edgesRes.data || []) as FlowEdge[];
  const currentNodeId = execRes.data?.current_node_id;
  const contactId = execRes.data?.contact_id;

  if (!currentNodeId) {
    console.error("[FlowExecutor] current_node_id não encontrado");
    return;
  }

  // Criar mapa de nós
  const nodeMap = new Map<string, FlowNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Encontrar próximo nó a partir do atual
  let nodeId: string | null = currentNodeId;
  let iterationCount = 0;
  const MAX_ITERATIONS = 100; // Previne loops infinitos

  while (nodeId && iterationCount < MAX_ITERATIONS) {
    iterationCount++;
    const node = nodeMap.get(nodeId);
    
    if (!node) {
      console.error(`[FlowExecutor] Nó não encontrado: ${nodeId}`);
      break;
    }

    console.log(`[FlowExecutor] Executando nó: ${node.node_type} (${nodeId})`);

    // Atualizar nó atual
    await supabase
      .from("whatsapp_flow_executions")
      .update({ current_node_id: nodeId })
      .eq("id", executionId);

    // ===== PROCESSAR NÓ =====
    const result = await processNode(supabase, node, companyId, contactId, context);

    if (result.action === "stop") {
      // Finalizar execução
      await supabase
        .from("whatsapp_flow_executions")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString(),
          context: context as unknown,
        })
        .eq("id", executionId);
      
      console.log(`[FlowExecutor] ✅ Fluxo finalizado: ${executionId}`);
      return;
    }

    if (result.action === "wait_delay") {
      // Aguardar delay - pausar execução
      await supabase
        .from("whatsapp_flow_executions")
        .update({ 
          status: "waiting",
          next_action_at: result.resume_at,
          context: context as unknown,
        })
        .eq("id", executionId);
      
      console.log(`[FlowExecutor] ⏸️ Aguardando até: ${result.resume_at}`);
      return;
    }

    if (result.action === "wait_response") {
      // Aguardar resposta do usuário
      await supabase
        .from("whatsapp_flow_executions")
        .update({ 
          status: "waiting",
          context: context as unknown,
        })
        .eq("id", executionId);
      
      console.log(`[FlowExecutor] ⏸️ Aguardando resposta do usuário`);
      return;
    }

    // Atualizar contexto se coletou dados
    if (result.collected_data) {
      context.collected_data = { ...context.collected_data, ...result.collected_data };
    }

    // ===== ENCONTRAR PRÓXIMO NÓ =====
    const outgoingEdges = edges.filter(e => e.source_node_id === nodeId);
    
    if (outgoingEdges.length === 0) {
      // Fim do fluxo
      await supabase
        .from("whatsapp_flow_executions")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
          context: context as unknown,
        })
        .eq("id", executionId);
      
      console.log(`[FlowExecutor] ✅ Fluxo finalizado (sem saídas): ${executionId}`);
      return;
    }

    // Se é condição, usar o handle específico
    if (result.next_handle && node.node_type === "condition") {
      const matchingEdge = outgoingEdges.find(e => e.source_handle === result.next_handle);
      nodeId = matchingEdge?.target_node_id || null;
    } else {
      // Próximo nó padrão
      nodeId = outgoingEdges[0]?.target_node_id || null;
    }
  }

  if (iterationCount >= MAX_ITERATIONS) {
    console.error(`[FlowExecutor] ⚠️ Limite de iterações atingido! Possível loop.`);
    await supabase
      .from("whatsapp_flow_executions")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", executionId);
  }
}

// ===== PROCESSAR NÓ INDIVIDUAL =====
interface ProcessResult {
  action: "continue" | "stop" | "wait_delay" | "wait_response";
  resume_at?: string;
  next_handle?: string;
  collected_data?: Record<string, unknown>;
}

async function processNode(
  supabase: ReturnType<typeof createClient>,
  node: FlowNode,
  companyId: string,
  contactId: string | null,
  context: ExecutionContext
): Promise<ProcessResult> {
  const config = node.config;

  switch (node.node_type) {
    case "start":
      return { action: "continue" };

    case "message": {
      if (!contactId) return { action: "continue" };
      
      const messageText = replaceVariables(config.message as string || "", context);
      
      // Enviar mensagem via WhatsApp
      await sendWhatsAppMessage(supabase, companyId, contactId, messageText);
      
      return { action: "continue" };
    }

    case "template": {
      if (!contactId) return { action: "continue" };
      
      const templateName = config.template_name as string;
      const templateLanguage = config.template_language as string || "pt_BR";
      
      // Enviar template via WhatsApp
      await sendWhatsAppTemplate(supabase, companyId, contactId, templateName, templateLanguage);
      
      return { action: "continue" };
    }

    case "media": {
      if (!contactId) return { action: "continue" };
      
      const mediaUrl = config.media_url as string;
      const mediaType = config.media_type as string || "image";
      const caption = replaceVariables(config.caption as string || "", context);
      
      // Enviar mídia via WhatsApp
      await sendWhatsAppMedia(supabase, companyId, contactId, mediaUrl, mediaType, caption);
      
      return { action: "continue" };
    }

    case "delay": {
      const delayValue = config.delay_value as number || 1;
      const delayUnit = config.delay_unit as string || "minutes";
      const smartDelay = config.smart_delay as boolean;
      
      let delayMs = delayValue;
      switch (delayUnit) {
        case "seconds": delayMs = delayValue * 1000; break;
        case "minutes": delayMs = delayValue * 60 * 1000; break;
        case "hours": delayMs = delayValue * 60 * 60 * 1000; break;
        case "days": delayMs = delayValue * 24 * 60 * 60 * 1000; break;
      }
      
      // Smart delay: adicionar variação aleatória (±20%)
      if (smartDelay) {
        const variation = delayMs * 0.2 * (Math.random() * 2 - 1);
        delayMs = Math.max(1000, delayMs + variation);
      }
      
      const resumeAt = new Date(Date.now() + delayMs).toISOString();
      
      return { action: "wait_delay", resume_at: resumeAt };
    }

    case "wait_response": {
      // Aguardar resposta do usuário
      return { action: "wait_response" };
    }

    case "condition": {
      const field = config.field as string || "last_message";
      const operator = config.operator as string || "contains";
      const value = config.value as string || "";
      
      let fieldValue = "";
      switch (field) {
        case "last_message": fieldValue = context.last_message || ""; break;
        case "contact_name": fieldValue = context.contact_name || ""; break;
        case "lead_name": fieldValue = context.lead_name || ""; break;
        case "lead_email": fieldValue = context.lead_email || ""; break;
      }

      let conditionMet = false;
      switch (operator) {
        case "equals": conditionMet = fieldValue.toLowerCase() === value.toLowerCase(); break;
        case "not_equals": conditionMet = fieldValue.toLowerCase() !== value.toLowerCase(); break;
        case "contains": conditionMet = fieldValue.toLowerCase().includes(value.toLowerCase()); break;
        case "not_contains": conditionMet = !fieldValue.toLowerCase().includes(value.toLowerCase()); break;
        case "starts_with": conditionMet = fieldValue.toLowerCase().startsWith(value.toLowerCase()); break;
        case "ends_with": conditionMet = fieldValue.toLowerCase().endsWith(value.toLowerCase()); break;
        case "is_empty": conditionMet = !fieldValue || fieldValue.trim() === ""; break;
        case "is_not_empty": conditionMet = !!fieldValue && fieldValue.trim() !== ""; break;
      }

      return { action: "continue", next_handle: conditionMet ? "true" : "false" };
    }

    case "end": {
      // Executar ações finais (adicionar tag, mover estágio, etc.)
      const addTag = config.add_tag as string;
      const moveToStage = config.move_to_stage as string;

      // Buscar lead associado ao contato
      if (addTag || moveToStage) {
        const { data: contact } = await supabase
          .from("whatsapp_contacts")
          .select("normalized_phone")
          .eq("id", contactId)
          .single();

        if (contact?.normalized_phone) {
          const { data: lead } = await supabase
            .from("funnel_leads")
            .select("id, tags")
            .eq("company_id", companyId)
            .eq("phone", contact.normalized_phone)
            .maybeSingle();

          if (lead) {
            const updates: Record<string, unknown> = {};
            
            if (addTag) {
              const currentTags = (lead.tags || []) as string[];
              if (!currentTags.includes(addTag)) {
                updates.tags = [...currentTags, addTag];
              }
            }
            
            if (moveToStage) {
              updates.stage_id = moveToStage;
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from("funnel_leads").update(updates).eq("id", lead.id);
            }
          }
        }
      }

      return { action: "stop" };
    }

    default:
      return { action: "continue" };
  }
}

// ===== ENVIAR MENSAGEM WHATSAPP =====
async function sendWhatsAppMessage(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
  message: string
) {
  try {
    // Buscar dados da empresa
    const { data: company } = await supabase
      .from("companies")
      .select("whatsapp_mode, whatsapp_phone_number_id")
      .eq("id", companyId)
      .single();

    // Buscar telefone do contato
    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("phone")
      .eq("id", contactId)
      .single();

    if (!contact) return;

    if (company?.whatsapp_mode === "cloud" && company.whatsapp_phone_number_id) {
      // Enviar via Cloud API
      const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN");
      
      await fetch(`https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.phone.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      });
    } else {
      // Enviar via Baileys (servidor externo)
      const whatsappServerUrl = Deno.env.get("WHATSAPP_SERVER_URL");
      const whatsappServerSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");
      
      if (whatsappServerUrl) {
        await fetch(`${whatsappServerUrl}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-server-token": whatsappServerSecret || "",
          },
          body: JSON.stringify({
            company_id: companyId,
            phone: contact.phone,
            message,
            message_type: "text",
          }),
        });
      }
    }

    // Salvar mensagem no banco
    await supabase.from("whatsapp_messages").insert({
      company_id: companyId,
      contact_id: contactId,
      content: message,
      message_type: "text",
      is_from_me: true,
      status: "sent",
    });

    // Atualizar último contato
    await supabase
      .from("whatsapp_contacts")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", contactId);

    console.log(`[FlowExecutor] 📤 Mensagem enviada para: ${contactId}`);
  } catch (error) {
    console.error("[FlowExecutor] Erro ao enviar mensagem:", error);
  }
}

// ===== ENVIAR TEMPLATE WHATSAPP =====
async function sendWhatsAppTemplate(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
  templateName: string,
  templateLanguage: string
) {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("whatsapp_phone_number_id")
      .eq("id", companyId)
      .single();

    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("phone")
      .eq("id", contactId)
      .single();

    if (!company?.whatsapp_phone_number_id || !contact) return;

    const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN");

    await fetch(`https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: contact.phone.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
        },
      }),
    });

    // Salvar mensagem
    await supabase.from("whatsapp_messages").insert({
      company_id: companyId,
      contact_id: contactId,
      content: `[Template: ${templateName}]`,
      message_type: "template",
      is_from_me: true,
      status: "sent",
    });

    console.log(`[FlowExecutor] 📤 Template enviado: ${templateName}`);
  } catch (error) {
    console.error("[FlowExecutor] Erro ao enviar template:", error);
  }
}

// ===== ENVIAR MÍDIA WHATSAPP =====
async function sendWhatsAppMedia(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
  mediaUrl: string,
  mediaType: string,
  caption: string
) {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("whatsapp_phone_number_id")
      .eq("id", companyId)
      .single();

    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("phone")
      .eq("id", contactId)
      .single();

    if (!company?.whatsapp_phone_number_id || !contact) return;

    const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN");

    const mediaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: contact.phone.replace(/\D/g, ""),
      type: mediaType,
    };

    // Configurar payload baseado no tipo
    if (mediaType === "image") {
      mediaPayload.image = { link: mediaUrl, caption };
    } else if (mediaType === "video") {
      mediaPayload.video = { link: mediaUrl, caption };
    } else if (mediaType === "audio") {
      mediaPayload.audio = { link: mediaUrl };
    } else if (mediaType === "document") {
      mediaPayload.document = { link: mediaUrl, caption };
    }

    await fetch(`https://graph.facebook.com/v18.0/${company.whatsapp_phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mediaPayload),
    });

    // Salvar mensagem
    await supabase.from("whatsapp_messages").insert({
      company_id: companyId,
      contact_id: contactId,
      content: caption || `[${mediaType}]`,
      message_type: mediaType,
      media_url: mediaUrl,
      is_from_me: true,
      status: "sent",
    });

    console.log(`[FlowExecutor] 📤 Mídia enviada: ${mediaType}`);
  } catch (error) {
    console.error("[FlowExecutor] Erro ao enviar mídia:", error);
  }
}
