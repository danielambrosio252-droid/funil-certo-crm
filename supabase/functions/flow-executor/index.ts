import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowNode {
  id: string;
  flow_id: string;
  company_id: string;
  node_type: string;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
}

interface ChatbotFlow {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  trigger_keywords: string[];
}

// Send message via WhatsApp Cloud API
async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      return false;
    }

    console.log(`✅ Message sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return false;
  }
}

// Find matching flow for a message
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findMatchingFlow(
  supabase: any,
  companyId: string,
  messageContent: string
): Promise<ChatbotFlow | null> {
  console.log(`🔍 Finding flow for company: ${companyId}, message: "${messageContent}"`);
  
  // Get all active flows for the company
  const { data: flows, error } = await supabase
    .from("chatbot_flows")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching flows:", error);
    return null;
  }

  console.log(`📋 Found ${flows?.length || 0} active flows`);

  if (!flows || flows.length === 0) {
    // Also try without is_active filter to see if flows exist
    const { data: allFlows } = await supabase
      .from("chatbot_flows")
      .select("id, name, is_active, is_default")
      .eq("company_id", companyId);
    
    console.log(`📋 Total flows (any status): ${allFlows?.length || 0}`, allFlows);
    return null;
  }

  const messageLower = messageContent.toLowerCase().trim();

  // First, check for keyword matches
  for (const flow of flows) {
    const f = flow as ChatbotFlow;
    console.log(`  - Flow "${f.name}": is_default=${f.is_default}, keywords=${JSON.stringify(f.trigger_keywords)}`);
    
    if (f.trigger_keywords && f.trigger_keywords.length > 0) {
      for (const keyword of f.trigger_keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          console.log(`✅ Keyword match: "${keyword}" -> Flow: ${f.name}`);
          return f;
        }
      }
    }
  }

  // If no keyword match, use default flow
  const defaultFlow = flows.find((f: ChatbotFlow) => f.is_default);
  if (defaultFlow) {
    console.log(`✅ Using default flow: ${defaultFlow.name}`);
    return defaultFlow as ChatbotFlow;
  }

  // FALLBACK: If no default, use the first active flow
  if (flows.length > 0) {
    console.log(`⚠️ No default flow, using first active: ${flows[0].name}`);
    return flows[0] as ChatbotFlow;
  }

  console.log("❌ No matching flow found");
  return null;
}

// Get the start node and its first connected node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStartNode(
  supabase: any,
  flowId: string
): Promise<{ startNode: FlowNode; firstNode: FlowNode | null } | null> {
  const { data: nodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("flow_id", flowId)
    .eq("node_type", "start")
    .limit(1);

  if (!nodes || nodes.length === 0) {
    console.error("No start node found");
    return null;
  }

  const startNode = nodes[0] as FlowNode;

  // Get the first connected node
  const { data: edges } = await supabase
    .from("chatbot_flow_edges")
    .select("*")
    .eq("flow_id", flowId)
    .eq("source_node_id", startNode.id)
    .limit(1);

  if (!edges || edges.length === 0) {
    return { startNode, firstNode: null };
  }

  const { data: targetNodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", edges[0].target_node_id)
    .limit(1);

  return {
    startNode,
    firstNode: targetNodes?.[0] as FlowNode || null,
  };
}

// Get next node after current
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNextNode(
  supabase: any,
  flowId: string,
  currentNodeId: string,
  sourceHandle?: string | null
): Promise<FlowNode | null> {
  let query = supabase
    .from("chatbot_flow_edges")
    .select("*")
    .eq("flow_id", flowId)
    .eq("source_node_id", currentNodeId);

  if (sourceHandle) {
    query = query.eq("source_handle", sourceHandle);
  }

  const { data: edges } = await query.limit(1);

  if (!edges || edges.length === 0) {
    return null;
  }

  const { data: nodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", edges[0].target_node_id)
    .limit(1);

  return nodes?.[0] as FlowNode || null;
}

// Process a single node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processNode(
  supabase: any,
  node: FlowNode,
  context: {
    companyId: string;
    contactId: string;
    contactPhone: string;
    phoneNumberId: string;
    accessToken: string;
    executionId: string;
    lastUserMessage?: string;
  }
): Promise<{
  shouldContinue: boolean;
  nextNode: FlowNode | null;
  waitForResponse?: boolean;
  delaySeconds?: number;
  sourceHandle?: string;
}> {
  console.log(`📦 Processing node: ${node.node_type} (${node.id})`);

  const config = node.config || {};

  switch (node.node_type) {
    case "message": {
      const message = (config.message as string) || "";
      if (message) {
        await sendWhatsAppMessage(
          context.phoneNumberId,
          context.accessToken,
          context.contactPhone,
          message
        );

        // Save outgoing message to DB
        await supabase.from("whatsapp_messages").insert({
          company_id: context.companyId,
          contact_id: context.contactId,
          content: message,
          message_type: "text",
          is_from_me: true,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
    }

    case "question": {
      const question = (config.question as string) || "";
      const options = (config.options as string[]) || [];

      // Build question message with options
      let fullMessage = question;
      if (options.length > 0) {
        fullMessage += "\n\n";
        options.forEach((opt, idx) => {
          fullMessage += `${idx + 1}. ${opt}\n`;
        });
      }

      if (fullMessage) {
        await sendWhatsAppMessage(
          context.phoneNumberId,
          context.accessToken,
          context.contactPhone,
          fullMessage
        );

        await supabase.from("whatsapp_messages").insert({
          company_id: context.companyId,
          contact_id: context.contactId,
          content: fullMessage,
          message_type: "text",
          is_from_me: true,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      // Update execution to wait for response
      await supabase
        .from("chatbot_flow_executions")
        .update({
          current_node_id: node.id,
          status: "waiting_response",
          context: { ...config, waiting_for: "question_response" },
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null, waitForResponse: true };
    }

    case "delay": {
      const delayValue = (config.delay_value as number) || 1;
      const delayUnit = (config.delay_unit as string) || "seconds";

      let delaySeconds = delayValue;
      if (delayUnit === "minutes") delaySeconds = delayValue * 60;
      else if (delayUnit === "hours") delaySeconds = delayValue * 3600;

      // For short delays (< 30s), just wait
      if (delaySeconds <= 30) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        const nextNode = await getNextNode(supabase, node.flow_id, node.id);
        return { shouldContinue: true, nextNode };
      }

      // For longer delays, schedule and pause execution
      const nextActionAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      await supabase
        .from("chatbot_flow_executions")
        .update({
          current_node_id: node.id,
          status: "paused",
          next_action_at: nextActionAt,
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null, delaySeconds };
    }

    case "condition": {
      // Simple condition check based on last message
      const conditionField = (config.field as string) || "last_message";
      const conditionOperator = (config.operator as string) || "contains";
      const conditionValue = (config.value as string) || "";

      let conditionMet = false;

      if (conditionField === "last_message" && context.lastUserMessage) {
        const msgLower = context.lastUserMessage.toLowerCase();
        const valueLower = conditionValue.toLowerCase();

        switch (conditionOperator) {
          case "contains":
            conditionMet = msgLower.includes(valueLower);
            break;
          case "equals":
            conditionMet = msgLower === valueLower;
            break;
          case "starts_with":
            conditionMet = msgLower.startsWith(valueLower);
            break;
          case "ends_with":
            conditionMet = msgLower.endsWith(valueLower);
            break;
          default:
            conditionMet = true;
        }
      }

      // Get next node based on condition result
      const sourceHandle = conditionMet ? "true" : "false";
      const nextNode = await getNextNode(supabase, node.flow_id, node.id, sourceHandle);

      return { shouldContinue: true, nextNode, sourceHandle };
    }

    case "action": {
      const actionType = (config.action_type as string) || "";
      console.log(`🎬 Executing action: ${actionType}`);

      // Actions can be expanded later (move lead to stage, add tag, etc.)
      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
    }

    case "transfer": {
      // Mark as human takeover
      await supabase
        .from("chatbot_flow_executions")
        .update({
          status: "completed",
          is_human_takeover: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", context.executionId);

      const transferMessage = (config.message as string) || "Você será atendido por um humano em breve.";
      await sendWhatsAppMessage(
        context.phoneNumberId,
        context.accessToken,
        context.contactPhone,
        transferMessage
      );

      return { shouldContinue: false, nextNode: null };
    }

    case "end": {
      // Complete execution
      await supabase
        .from("chatbot_flow_executions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null };
    }

    default:
      console.log(`Unknown node type: ${node.node_type}`);
      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
  }
}

// Main execution loop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFlow(
  supabase: any,
  flow: ChatbotFlow,
  contactId: string,
  contactPhone: string,
  phoneNumberId: string,
  accessToken: string,
  triggerMessage?: string
) {
  console.log(`🚀 Starting flow execution: ${flow.name}`);

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from("chatbot_flow_executions")
    .insert({
      flow_id: flow.id,
      company_id: flow.company_id,
      contact_id: contactId,
      status: "running",
      context: { trigger_message: triggerMessage },
    })
    .select()
    .single();

  if (execError || !execution) {
    console.error("Failed to create execution:", execError);
    return;
  }

  console.log(`📝 Execution created: ${execution.id}`);

  // Get start node and first connected node
  const startInfo = await getStartNode(supabase, flow.id);
  if (!startInfo || !startInfo.firstNode) {
    console.log("No nodes to execute after start");
    await supabase
      .from("chatbot_flow_executions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", execution.id);
    return;
  }

  // Process nodes
  let currentNode: FlowNode | null = startInfo.firstNode;
  let iterationCount = 0;
  const maxIterations = 50; // Prevent infinite loops

  while (currentNode && iterationCount < maxIterations) {
    iterationCount++;

    // Log node execution
    await supabase.from("chatbot_flow_logs").insert({
      execution_id: execution.id,
      company_id: flow.company_id,
      node_id: currentNode.id,
      node_type: currentNode.node_type,
      action: "executed",
      details: { iteration: iterationCount },
    });

    const result = await processNode(supabase, currentNode, {
      companyId: flow.company_id,
      contactId,
      contactPhone,
      phoneNumberId,
      accessToken,
      executionId: execution.id,
      lastUserMessage: triggerMessage,
    });

    if (!result.shouldContinue) {
      console.log("⏸️ Execution paused or completed");
      break;
    }

    currentNode = result.nextNode;

    // Small delay between nodes to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (iterationCount >= maxIterations) {
    console.error("⚠️ Max iterations reached, stopping execution");
    await supabase
      .from("chatbot_flow_executions")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", execution.id);
  }
}

// Handle continuing an execution (after user response or delay)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function continueExecution(
  supabase: any,
  executionId: string,
  userResponse?: string
) {
  const { data: execution } = await supabase
    .from("chatbot_flow_executions")
    .select("*, chatbot_flows(*)")
    .eq("id", executionId)
    .single();

  if (!execution || !execution.current_node_id) {
    console.log("Execution not found or no current node");
    return;
  }

  // Get current node
  const { data: currentNode } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", execution.current_node_id)
    .single();

  if (!currentNode) return;

  // Get contact info
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("phone, normalized_phone")
    .eq("id", execution.contact_id)
    .single();

  if (!contact) return;

  // Get company info
  const { data: company } = await supabase
    .from("companies")
    .select("whatsapp_phone_number_id")
    .eq("id", execution.company_id)
    .single();

  if (!company?.whatsapp_phone_number_id) return;

  const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") || "";

  // If it's a question node, determine the next path based on response
  if (currentNode.node_type === "question" && userResponse) {
    const options = (currentNode.config?.options as string[]) || [];
    const responseLower = userResponse.toLowerCase().trim();

    // Try to match by number (1, 2, 3...) or by content
    let matchedIndex = -1;
    const responseNum = parseInt(responseLower);
    
    if (!isNaN(responseNum) && responseNum >= 1 && responseNum <= options.length) {
      matchedIndex = responseNum - 1;
    } else {
      // Try to match by content
      matchedIndex = options.findIndex((opt: string) =>
        responseLower.includes(opt.toLowerCase())
      );
    }

    if (matchedIndex >= 0) {
      const sourceHandle = `option-${matchedIndex}`;
      const nextNode = await getNextNode(supabase, currentNode.flow_id, currentNode.id, sourceHandle);

      if (nextNode) {
        // Update execution status and continue
        await supabase
          .from("chatbot_flow_executions")
          .update({ status: "running", current_node_id: nextNode.id })
          .eq("id", executionId);

        // Continue processing from next node
        console.log(`✅ Matched option ${matchedIndex + 1}, continuing to ${nextNode.node_type}`);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") || "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { trigger_type, company_id, contact_id, message_content, execution_id } = body;

    console.log(`📨 Flow executor called: ${trigger_type}`);

    if (trigger_type === "keyword" && company_id && contact_id && message_content) {
      // Check if there's already an active execution for this contact
      const { data: existingExecution } = await supabase
        .from("chatbot_flow_executions")
        .select("id")
        .eq("company_id", company_id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting_response"])
        .maybeSingle();

      if (existingExecution) {
        console.log("Active execution exists, skipping new flow start");
        return new Response(JSON.stringify({ status: "skipped", reason: "active_execution" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find matching flow
      const flow = await findMatchingFlow(supabase, company_id, message_content);

      if (!flow) {
        return new Response(JSON.stringify({ status: "no_flow" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get contact phone
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("phone, normalized_phone")
        .eq("id", contact_id)
        .single();

      if (!contact) {
        return new Response(JSON.stringify({ status: "contact_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get company phone_number_id
      const { data: company } = await supabase
        .from("companies")
        .select("whatsapp_phone_number_id")
        .eq("id", company_id)
        .single();

      if (!company?.whatsapp_phone_number_id) {
        return new Response(JSON.stringify({ status: "no_whatsapp_config" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute flow
      await executeFlow(
        supabase,
        flow,
        contact_id,
        contact.normalized_phone || contact.phone,
        company.whatsapp_phone_number_id,
        accessToken,
        message_content
      );

      return new Response(JSON.stringify({ status: "started", flow_id: flow.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trigger_type === "continue_execution" && execution_id) {
      // Get the last message from contact
      const { data: execution } = await supabase
        .from("chatbot_flow_executions")
        .select("contact_id")
        .eq("id", execution_id)
        .single();

      if (execution) {
        const { data: lastMessage } = await supabase
          .from("whatsapp_messages")
          .select("content")
          .eq("contact_id", execution.contact_id)
          .eq("is_from_me", false)
          .order("sent_at", { ascending: false })
          .limit(1)
          .single();

        await continueExecution(supabase, execution_id, lastMessage?.content);
      }

      return new Response(JSON.stringify({ status: "continued" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "invalid_request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Flow executor error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
